import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  hmrcOAuthAuthorizeBaseUrl,
  hmrcOAuthCredentialError,
  hmrcOAuthCredentials,
} from "../../../../lib/hmrc-oauth";
import { createPkcePair, hmrcPkceCookieName, HMRC_OAUTH_STATE_COOKIE } from "../../../../lib/hmrc-pkce";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForOrg } from "../../../../lib/hmrc-org-routing";

export async function GET() {
  const clerkAuth = await auth();
  const session = await getAuthenticatedConvex(clerkAuth);
  if ("error" in session) {
    return session.error;
  }
  const { convex, userId } = session;
  const { orgId } = clerkAuth;

  const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, orgId);
  if ("error" in orgRouting) {
    return orgRouting.error;
  }
  const { hmrcContext } = orgRouting;

  const credentialError = hmrcOAuthCredentialError(hmrcContext);
  if (credentialError) {
    return NextResponse.json({ error: credentialError }, { status: 500 });
  }

  const { clientId } = hmrcOAuthCredentials(hmrcContext);
  const redirectUri = process.env.HMRC_REDIRECT_URI;
  const scopes = process.env.HMRC_SCOPES || "write:customs-declaration write:customs-declarations-information";
  const hmrcAuthBase = `${hmrcOAuthAuthorizeBaseUrl(hmrcContext)}/oauth/authorize`;

  if (!redirectUri) {
    return NextResponse.json({ error: "Missing HMRC_REDIRECT_URI" }, { status: 500 });
  }

  const stateNonce = crypto.randomUUID();
  const state = `${stateNonce}.${userId}`;
  const { codeVerifier, codeChallenge } = createPkcePair();

  try {
    const { api } = await import("../../../../../convex/_generated/api");
    await convex.mutation(api.hmrc.storeOAuthPkce, { stateNonce, codeVerifier });
  } catch (err) {
    console.warn("[HMRC AUTH] Convex PKCE store failed — cookie only:", err);
  }

  const hmrcAuthUrl = new URL(hmrcAuthBase);
  hmrcAuthUrl.searchParams.append("response_type", "code");
  hmrcAuthUrl.searchParams.append("client_id", clientId);
  hmrcAuthUrl.searchParams.append("scope", scopes);
  hmrcAuthUrl.searchParams.append("state", state);
  hmrcAuthUrl.searchParams.append("redirect_uri", redirectUri);
  hmrcAuthUrl.searchParams.append("code_challenge", codeChallenge);
  hmrcAuthUrl.searchParams.append("code_challenge_method", "S256");

  console.log("[HMRC AUTH] redirect_uri:", redirectUri);
  console.log("[HMRC AUTH] state_nonce:", stateNonce);

  const response = NextResponse.redirect(hmrcAuthUrl.toString());
  response.cookies.set(hmrcPkceCookieName(stateNonce), codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  response.cookies.set(HMRC_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
