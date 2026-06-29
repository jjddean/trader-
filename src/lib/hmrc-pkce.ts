import { createHash, randomBytes } from "crypto";

export const HMRC_PKCE_COOKIE_PREFIX = "hmrc_pkce_";
export const HMRC_OAUTH_STATE_COOKIE = "hmrc_oauth_state";

/** Cookie name for the PKCE verifier tied to a specific OAuth state nonce. */
export function hmrcPkceCookieName(stateNonce: string): string {
  return `${HMRC_PKCE_COOKIE_PREFIX}${stateNonce}`;
}

/** PKCE pair for HMRC user-restricted OAuth (optional per HMRC docs; used by this app). */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

/** First segment of OAuth state (`<uuid>.<clerkUserId>`). */
export function hmrcOAuthStateNonce(state: string): string | null {
  if (!state.includes(".")) return null;
  return state.split(".")[0] || null;
}
