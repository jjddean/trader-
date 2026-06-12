const V1_XML = process.env.HMRC_ACCEPT_V1_XML || "application/vnd.hmrc.1.0+xml";
const V2_XML = process.env.HMRC_ACCEPT_V2_XML || "application/vnd.hmrc.2.0+xml";

/** Active CDS phase — see docs/hmrc/ACTIVE/tdr/environment-matrix.md */
export function hmrcPhase(): "trade_test" | "tdr" | "live" {
  const label = (process.env.NEXT_PUBLIC_HMRC_ENV || "").toLowerCase();
  if (label === "tdr") return "tdr";
  if (label === "production" || label === "live") return "live";
  if (process.env.HMRC_ENVIRONMENT === "sandbox") return "trade_test";
  if (process.env.HMRC_DECLARATIONS_ACCEPT?.includes("1.0")) return "tdr";
  return "live";
}

/** Declarations API Accept — TDR v1.0, Trade Test / CDS Live v2.0 */
export function declarationsAcceptHeader(): string {
  if (process.env.HMRC_DECLARATIONS_ACCEPT) {
    return process.env.HMRC_DECLARATIONS_ACCEPT;
  }
  return hmrcPhase() === "tdr" ? V1_XML : V2_XML;
}

/** HMRC Customs Declarations API paths (v1.0 and v2.0). */
export type DeclarationsOperation = "submit" | "cancel" | "amend";

export function declarationsEndpointPath(operation: DeclarationsOperation): string {
  switch (operation) {
    case "submit":
      return "/customs/declarations";
    case "cancel":
      return "/customs/declarations/cancellation-requests";
    case "amend":
      return "/customs/declarations/amend";
  }
}

export function declarationsEndpointUrl(baseUrl: string, operation: DeclarationsOperation): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${declarationsEndpointPath(operation)}`;
}

/** Information API Accept — sandbox host v1.0; production TDR/Live v2.0 */
export function informationAcceptHeader(): string {
  if (process.env.HMRC_INFORMATION_ACCEPT) {
    return process.env.HMRC_INFORMATION_ACCEPT;
  }
  if (process.env.HMRC_ENVIRONMENT === "sandbox") {
    return V1_XML;
  }
  return hmrcPhase() === "trade_test" ? V1_XML : V2_XML;
}

export const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",

  accept: {
    get declarations() {
      return declarationsAcceptHeader();
    },
    v2Xml: V2_XML,
    v2Json: process.env.HMRC_ACCEPT_V2_JSON || "application/vnd.hmrc.2.0+json",
    v1Xml: V1_XML,
    v1Json: process.env.HMRC_ACCEPT_V1_JSON || "application/vnd.hmrc.1.0+json",
  },

  vendor: {
    publicIp: process.env.HMRC_VENDOR_PUBLIC_IP,
    productName: process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode",
    version: process.env.HMRC_VENDOR_VERSION || "1.0.0",
  },

  timing: {
    tokenExpiryBufferMs: Number(process.env.HMRC_TOKEN_EXPIRY_BUFFER_MS) || 300000,
    defaultTokenExpiryMs: Number(process.env.HMRC_DEFAULT_TOKEN_EXPIRY_MS) || 14400,
    fetchTimeoutMs: Number(process.env.HMRC_FETCH_TIMEOUT_MS) || 30000,
    rateLimitRps: Number(process.env.HMRC_RATE_LIMIT_RPS) || 3,
    retryDelayRateLimitMs: Number(process.env.HMRC_RETRY_DELAY_RATE_LIMIT_MS) || 2000,
    retryDelayServerErrorMs: Number(process.env.HMRC_RETRY_DELAY_SERVER_ERROR_MS) || 1000,
    retryDelayRateLimitSecondMs: Number(process.env.HMRC_RETRY_DELAY_RATE_LIMIT_SECOND_MS) || 5000,
    retryDelayServerErrorSecondMs: Number(process.env.HMRC_RETRY_DELAY_SERVER_ERROR_SECOND_MS) || 3000,
  },
} as const;
