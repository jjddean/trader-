import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { HMRC_CONFIG } from "../../../../lib/hmrc-config";
import { hmrcOAuthBaseUrl, hmrcOAuthCredentials } from "../../../../lib/hmrc-oauth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    console.error("HMRC Auth Error:", error, errorDescription);
    return NextResponse.redirect(new URL(`/dashboard?error=${error}`, request.url));
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
      console.error("HMRC callback without an authenticated Clerk session — refusing to link tokens.");
      return NextResponse.redirect(new URL("/dashboard?error=login_required", request.url));
    }
    if (userIdFromState && userIdFromState !== sessionUserId) {
      console.error("HMRC callback state/session mismatch — possible CSRF; refusing.");
      return NextResponse.redirect(new URL("/dashboard?error=state_mismatch", request.url));
    }
    const userId = sessionUserId;

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      console.error("HMRC callback: no Convex token for session — cannot persist tokens.");
      return NextResponse.redirect(new URL("/dashboard?error=login_required", request.url));
    }
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const { clientId, clientSecret } = hmrcOAuthCredentials();
    const redirectUri = process.env.HMRC_REDIRECT_URI!;

    const hmrcBase = hmrcOAuthBaseUrl();
    const tokenUrl = `${hmrcBase}/oauth/token`;
    console.log("EXCHANGING TOKEN WITH REDIRECT URI:", redirectUri);
    
    const body = new URLSearchParams({
      client_secret: clientSecret,
      client_id: clientId,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
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
      return NextResponse.redirect(new URL("/dashboard?error=token_exchange_failed", request.url));
    }

    const data = await response.json();
    
    // Save tokens to Convex and link to workspace
    await convex.mutation(api.hmrc.saveToken, {
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || HMRC_CONFIG.timing.defaultTokenExpiryMs,
    });

    return NextResponse.redirect(new URL("/dashboard?success=hmrc_connected", request.url));

  } catch (err: any) {
    console.error("Exception in HMRC callback:", err);
    return NextResponse.redirect(new URL(`/dashboard?error=internal_error&msg=${encodeURIComponent(err.message || "unknown")}`, request.url));
  }
}
