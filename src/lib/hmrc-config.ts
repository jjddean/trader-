export const HMRC_CONFIG = {
  sandboxBaseUrl: process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk",
  productionBaseUrl: process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk",

  accept: {
    declarations: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.2.0+xml",
    v2Xml: process.env.HMRC_ACCEPT_V2_XML || "application/vnd.hmrc.2.0+xml",
    v2Json: process.env.HMRC_ACCEPT_V2_JSON || "application/vnd.hmrc.2.0+json",
    v1Xml: process.env.HMRC_ACCEPT_V1_XML || "application/vnd.hmrc.1.0+xml",
  },

  vendor: {
    publicIp: process.env.HMRC_VENDOR_PUBLIC_IP,
    productName: process.env.HMRC_VENDOR_PRODUCT_NAME || "Freightcode",
    version: process.env.HMRC_VENDOR_VERSION || "1.0.0",
  },

  timing: {
    tokenExpiryBufferMs: Number(process.env.HMRC_TOKEN_EXPIRY_BUFFER_MS) || 300000,
    defaultTokenExpiryMs: Number(process.env.HMRC_DEFAULT_TOKEN_EXPIRY_MS) || 14400,
    retryDelayRateLimitMs: Number(process.env.HMRC_RETRY_DELAY_RATE_LIMIT_MS) || 2000,
    retryDelayServerErrorMs: Number(process.env.HMRC_RETRY_DELAY_SERVER_ERROR_MS) || 1000,
    retryDelayRateLimitSecondMs: Number(process.env.HMRC_RETRY_DELAY_RATE_LIMIT_SECOND_MS) || 5000,
    retryDelayServerErrorSecondMs: Number(process.env.HMRC_RETRY_DELAY_SERVER_ERROR_SECOND_MS) || 3000,
  },
} as const;
