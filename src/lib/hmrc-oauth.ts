import { HMRC_CONFIG } from "./hmrc-config";

export function isHmrcSandbox(): boolean {
  return process.env.HMRC_ENVIRONMENT === "sandbox";
}

export function hmrcOAuthBaseUrl(): string {
  return isHmrcSandbox()
    ? HMRC_CONFIG.sandboxBaseUrl
    : HMRC_CONFIG.productionBaseUrl;
}

/** OAuth client credentials for the active HMRC host (sandbox vs production/TDR). */
export function hmrcOAuthCredentials(): { clientId: string; clientSecret: string } {
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

export function hmrcOAuthCredentialError(): string | null {
  const { clientId, clientSecret } = hmrcOAuthCredentials();
  if (!clientId || !clientSecret) {
    return isHmrcSandbox()
      ? "Missing HMRC sandbox OAuth credentials (HMRC_CLIENT_ID / HMRC_CLIENT_SECRET)."
      : "Missing HMRC production OAuth credentials. Sandbox client IDs do not work on api.service.hmrc.gov.uk — set HMRC_PRODUCTION_CLIENT_ID and HMRC_PRODUCTION_CLIENT_SECRET from Developer Hub → your app → Production credentials.";
  }

  if (!isHmrcSandbox() && !process.env.HMRC_PRODUCTION_CLIENT_ID) {
    return "HMRC_ENVIRONMENT=production but HMRC_PRODUCTION_CLIENT_ID is not set. The sandbox client ID (HMRC_CLIENT_ID) is only valid on test-api.service.hmrc.gov.uk. Copy Production credentials from HMRC Developer Hub.";
  }

  return null;
}
