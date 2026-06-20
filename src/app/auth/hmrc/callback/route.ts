import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { hmrcOAuthBaseUrl, hmrcOAuthCredentials } from "../../../../lib/hmrc-oauth";
import { hmrcOAuthStateNonce, hmrcPkceCookieName } from "../../../../lib/hmrc-pkce";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForOrg } from "../../../../lib/hmrc-org-routing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("HMRC Auth Error:", error, errorDescription);
    const failUrl = new URL("/dashboard", request.url);
    failUrl.searchParams.set("error", error);
    if (errorDescription) {
      failUrl.searchParams.set("msg", errorDescription);
    }
    return NextResponse.redirect(failUrl);
  }

  if (!code) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // The signed-in Clerk session is the authority for whose tokens these are —
  // not the OAuth `state` (which is attacker-controllable and was previously
  // trusted directly, allowing token linking to an arbitrary user). The state
  // userId is only used to detect a session/state mismatch (CSRF guard).
  const clerkAuth = await auth();
  const sessionUserId = clerkAuth.userId;
  const state = searchParams.get("state") || "";
  const userIdFromState = state.includes(".") ? state.split(".").slice(1).join(".") : null;

  try {
    if (!sessionUserId) {
      console.error("HMRC callback without Clerk session — sending user to sign-in with return URL.");
      const returnUrl = new URL(request.url);
      const signIn = new URL("/sign-in", returnUrl.origin);
      signIn.searchParams.set("redirect_url", returnUrl.pathname + returnUrl.search);
      return NextResponse.redirect(signIn);
    }
    if (userIdFromState && userIdFromState !== sessionUserId) {
      console.error("HMRC callback state/session mismatch — possible CSRF; refusing.");
      return NextResponse.redirect(new URL("/dashboard?error=state_mismatch", request.url));
    }
    const userId = sessionUserId;

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      console.error("HMRC callback: no Convex JWT — cannot save tokens.");
      return NextResponse.redirect(
        new URL("/dashboard?error=internal_error&msg=Convex+JWT+missing.+Ensure+Clerk+convex+template+exists+and+npx+convex+dev+is+running.", request.url),
      );
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) {
      return NextResponse.redirect(new URL("/dashboard?error=routing_blocked", request.url));
    }
    const { hmrcContext } = orgRouting;

    const { clientId, clientSecret } = hmrcOAuthCredentials(hmrcContext);
    const redirectUri = process.env.HMRC_REDIRECT_URI!;

    const stateNonce = hmrcOAuthStateNonce(state);
    if (!stateNonce) {
      console.error("HMRC callback: malformed OAuth state — refusing.");
      return NextResponse.redirect(new URL("/dashboard?error=state_mismatch", request.url));
    }

    const cookieStore = await cookies();
    const pkceCookieName = hmrcPkceCookieName(stateNonce);
    let codeVerifier = cookieStore.get(pkceCookieName)?.value ?? null;

    if (!codeVerifier) {
      codeVerifier = await convex.mutation(api.hmrc.consumeOAuthPkce, { stateNonce });
    } else {
      await convex.mutation(api.hmrc.consumeOAuthPkce, { stateNonce }).catch(() => null);
    }

    if (!codeVerifier) {
      console.error("HMRC callback: missing PKCE verifier for state", stateNonce);
      return NextResponse.redirect(new URL("/dashboard?error=pkce_missing", request.url));
    }

    console.log("[HMRC CALLBACK] state_nonce:", stateNonce, "pkce: ok");
    const hmrcBase = hmrcOAuthBaseUrl(hmrcContext);
    const tokenUrl = `${hmrcBase}/oauth/token`;
    console.log("[HMRC CALLBACK] exchanging token, redirect_uri:", redirectUri);

    const body = new URLSearchParams({
      client_secret: clientSecret,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Failed to exchange token with HMRC:", errText);
      const failUrl = new URL("/dashboard", request.url);
      failUrl.searchParams.set("error", "token_exchange_failed");
      failUrl.searchParams.set("msg", errText.slice(0, 500));
      return NextResponse.redirect(failUrl);
    }

    const data = await response.json();
    
    // Save tokens to Convex and link to workspace
    await convex.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 14400,
    });

    const success = NextResponse.redirect(new URL("/dashboard?success=hmrc_connected", request.url));
    success.cookies.delete(pkceCookieName);
    return success;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("Exception in HMRC callback:", err);
    return NextResponse.redirect(new URL(`/dashboard?error=internal_error&msg=${encodeURIComponent(message)}`, request.url));
  }
}
