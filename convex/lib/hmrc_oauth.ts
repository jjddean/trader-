function isHmrcSandbox(): boolean {
  return process.env.HMRC_ENVIRONMENT === "sandbox";
}

function hmrcOAuthBaseUrl(): string {
  return isHmrcSandbox()
    ? process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk"
    : process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk";
}

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

export { hmrcOAuthBaseUrl, isHmrcSandbox };
