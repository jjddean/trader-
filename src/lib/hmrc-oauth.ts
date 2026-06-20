import { HMRC_CONFIG } from "./hmrc-config";
import type { ResolvedHmrcContext } from "./hmrc-context";

export function isHmrcSandbox(context?: ResolvedHmrcContext): boolean {
  if (context) return context.environment === "sandbox";
  return process.env.HMRC_ENVIRONMENT === "sandbox";
}

/** Token + API host (test-api / api.service). */
export function hmrcOAuthBaseUrl(context?: ResolvedHmrcContext): string {
  if (context) return context.apiBaseUrl;
  return isHmrcSandbox()
    ? HMRC_CONFIG.sandboxBaseUrl
    : HMRC_CONFIG.productionBaseUrl;
}

/**
 * Browser authorize host — HMRC user-restricted docs use test-www / www, not test-api.
 * @see https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation/user-restricted-endpoints
 */
export function hmrcOAuthAuthorizeBaseUrl(context?: ResolvedHmrcContext): string {
  if (context) return context.oauthAuthorizeBaseUrl;
  return isHmrcSandbox()
    ? process.env.HMRC_SANDBOX_OAUTH_AUTHORIZE_URL?.replace(/\/$/, "") ||
        "https://test-www.tax.service.gov.uk"
    : process.env.HMRC_PRODUCTION_OAUTH_AUTHORIZE_URL?.replace(/\/$/, "") ||
        "https://www.tax.service.gov.uk";
}

/** OAuth client credentials for the active HMRC host (sandbox vs production/TDR). */
export function hmrcOAuthCredentials(context?: ResolvedHmrcContext): { clientId: string; clientSecret: string } {
  if (context) {
    return { clientId: context.clientId, clientSecret: context.clientSecret };
  }
  if (isHmrcSandbox()) {
    return {
      clientId: process.env.HMRC_SANDBOX_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
      clientSecret: process.env.HMRC_SANDBOX_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
    };
  }

  return {
    clientId: process.env.HMRC_PRODUCTION_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
    clientSecret: process.env.HMRC_PRODUCTION_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
  };
}

export function hmrcOAuthCredentialError(context?: ResolvedHmrcContext): string | null {
  const { clientId, clientSecret } = hmrcOAuthCredentials(context);
  const sandbox = isHmrcSandbox(context);
  if (!clientId || !clientSecret) {
    return sandbox
      ? "Missing HMRC sandbox OAuth credentials (HMRC_CLIENT_ID / HMRC_CLIENT_SECRET)."
      : "Missing HMRC production OAuth credentials. Sandbox client IDs do not work on api.service.hmrc.gov.uk — set HMRC_PRODUCTION_CLIENT_ID and HMRC_PRODUCTION_CLIENT_SECRET from Developer Hub → your app → Production credentials.";
  }

  if (!sandbox && !process.env.HMRC_PRODUCTION_CLIENT_ID && !context) {
    return "HMRC_ENVIRONMENT=production but HMRC_PRODUCTION_CLIENT_ID is not set. The sandbox client ID (HMRC_CLIENT_ID) is only valid on test-api.service.hmrc.gov.uk. Copy Production credentials from HMRC Developer Hub.";
  }

  return null;
}
