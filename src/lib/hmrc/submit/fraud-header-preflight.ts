// Confirmed required set for WEB_APP_VIA_SERVER (HMRC Fraud Prevention v3.3, Jan 2025)
// Gov-Client-Local-IPs is NOT in this list — it is not required for WEB_APP_VIA_SERVER
// and sending 127.0.0.1/private IPs triggers HMRC WAF PAYLOAD_FORBIDDEN.
export const REQUIRED_CLIENT_FRAUD_HEADERS = [
  "gov-client-timezone",
  "gov-client-window-size",
  "gov-client-screens",
  "gov-client-browser-js-user-agent",
  "gov-client-browser-do-not-track",
  "gov-client-device-id",
  "gov-client-user-ids",
] as const;

export function validateClientFraudHeaders(headers: Headers) {
  const missing = REQUIRED_CLIENT_FRAUD_HEADERS.filter((name) => !headers.get(name));
  return {
    valid: missing.length === 0,
    missing,
  };
}
