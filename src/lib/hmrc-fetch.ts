import { HMRC_CONFIG } from "@/lib/hmrc-config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const encodeValue = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

// Reject loopback, link-local, and RFC1918 private ranges.
// HMRC WAF rejects any Gov-Client-Public-IP / Gov-Vendor-Public-IP set to these.
const isPrivateOrLoopback = (ip: string): boolean => {
  if (!ip) return true;
  const v = ip.trim();
  if (v === "::1" || v.startsWith("127.") || v.startsWith("10.") || v.startsWith("192.168.")) return true;
  const m = v.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (v.startsWith("169.254.") || v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) return true;
  return false;
};

export async function fetchHmrc(
  endpoint: string,
  options: RequestInit,
  req: Request,
  token: string,
  // Optional declarant EORI to set as X-Submitter-Identifier (DCS spec
  // requires either this or X-Badge-Identifier for CSPs on the Customs
  // Declarations API). Non-declaration endpoints (file upload, info, status)
  // can omit; declaration submit/amend/cancel must pass it.
  submitterEori?: string,
) {
  const vendorPublicIp = HMRC_CONFIG.vendor.publicIp || "203.0.113.6";
  // In local dev the browser and server are on the same machine, so the
  // "client public IP" is the vendor public IP. Forwarding 127.0.0.1 triggers
  // the HMRC WAF with PAYLOAD_FORBIDDEN.
  const rawClientIp = (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "").split(",")[0].trim();
  const clientIp = rawClientIp && !isPrivateOrLoopback(rawClientIp) ? rawClientIp : vendorPublicIp;
  const clientPort = req.headers.get("x-forwarded-port") || "443";
  
  // Base server-side HMRC headers
  const govHeaders: Record<string, string> = {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Version": `${HMRC_CONFIG.vendor.productName}=${HMRC_CONFIG.vendor.version}`,
    "Gov-Vendor-Product-Name": encodeValue(HMRC_CONFIG.vendor.productName),
    "Gov-Client-Public-IP": clientIp.split(",")[0].trim(),
    "Gov-Client-Public-IP-Timestamp": new Date().toISOString(),
    "Gov-Client-Public-Port": clientPort,
    "Gov-Vendor-Public-IP": vendorPublicIp,
    "Gov-Vendor-Forwarded": `by=${encodeValue(vendorPublicIp)}&for=${encodeValue(clientIp.split(",")[0].trim())}`,
  };

  // Client-sourced headers that must be forwarded from the NextJS API request
  const clientHeaders = [
    "Gov-Client-Timezone",
    "Gov-Client-Window-Size",
    "Gov-Client-Screens",
    "Gov-Client-Browser-JS-User-Agent",
    "Gov-Client-Browser-Do-Not-Track",
    // Gov-Client-Local-IPs omitted — not required for WEB_APP_VIA_SERVER; loopback/private IPs trigger HMRC WAF
    "Gov-Client-Device-ID",
    "Gov-Client-User-IDs",
    "Gov-Client-Multi-Factor",
    "Gov-Client-Browser-Plugins",
    "Gov-Client-User-Agent"
  ];
  
  for (const h of clientHeaders) {
    const val = req.headers.get(h.toLowerCase());
    if (val) {
      govHeaders[h] = val;
    }
  }

  const testScenario = process.env.HMRC_TEST_SCENARIO;
  const hmrcHeaders: Record<string, string> = {
    Accept: HMRC_CONFIG.accept.declarations,
    Authorization: `Bearer ${token}`,
    "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
    ...govHeaders,
    ...(submitterEori ? { "X-Submitter-Identifier": submitterEori } : {}),
    ...(options.headers as Record<string, string>),
  };

  // DEBUG LOGGING
  const maskedToken = (token || "").substring(0, 8) + "..." + (token || "").slice(-4);
  console.log(`[HMRC REQUEST] ${options.method} ${endpoint}`);
  console.log(`[HMRC HEADERS] X-Client-ID: ${hmrcHeaders["X-Client-ID"]}`);
  console.log(`[HMRC HEADERS] Authorization: Bearer ${maskedToken}`);
  console.log(`[HMRC HEADERS] Accept: ${hmrcHeaders["Accept"]}`);
  console.log(`[HMRC HEADERS] Gov-Client-Public-IP: ${hmrcHeaders["Gov-Client-Public-IP"]}`);
  console.log(`[HMRC HEADERS] Gov-Vendor-Public-IP: ${hmrcHeaders["Gov-Vendor-Public-IP"]}`);
  console.log(`[HMRC HEADERS] Gov-Client-Connection-Method: ${hmrcHeaders["Gov-Client-Connection-Method"]}`);
  console.log(`[HMRC HEADERS] Gov-Client-Device-ID: ${hmrcHeaders["Gov-Client-Device-ID"] || "(missing)"}`);
  console.log(`[HMRC HEADERS] Gov-Client-User-IDs: ${hmrcHeaders["Gov-Client-User-IDs"] || "(missing)"}`);
  console.log(`[HMRC HEADERS] Gov-Test-Scenario: ${testScenario || "(none)"}`);
  console.log(`[HMRC ALL HEADERS]`);
  for (const [k, v] of Object.entries(hmrcHeaders)) {
    if (k === "Authorization") continue;
    const masked = k === "X-Client-ID" ? (v as string).slice(0, 6) + "..." : v;
    console.log(`  ${k}: ${masked}`);
  }

  // Gov-Test-Scenario is a v1.0 sandbox feature for driving canned outcomes.
  // The current Trade Test sandbox + production both run on v2.0, where CDS
  // executes real business logic and rejects Gov-Test-Scenario at the WAF
  // (PAYLOAD_FORBIDDEN). Suppress it whenever Accept is v2.0.
  const acceptHeader = String(hmrcHeaders["Accept"] || "");
  const isV2 = acceptHeader.includes("hmrc.2.0");
  const isNotificationsApi = endpoint.includes("/notifications/");
  // Gov-Test-Scenario is for declaration sandbox only — sending it on pull/push APIs returns 400.
  if (testScenario && !isV2 && !isNotificationsApi) {
    hmrcHeaders["Gov-Test-Scenario"] = testScenario;
  }

  const fetchOptions = {
    ...options,
    headers: hmrcHeaders,
  };

  let hmrcResponse = await fetch(endpoint, fetchOptions);

  // Retry on rate limit (429) and transient server errors (502/503/504)
  const isRetryable = (status: number) => status === 429 || status === 502 || status === 503 || status === 504;

  if (isRetryable(hmrcResponse.status)) {
    const delay = hmrcResponse.status === 429
      ? HMRC_CONFIG.timing.retryDelayRateLimitMs
      : HMRC_CONFIG.timing.retryDelayServerErrorMs;
    await sleep(delay);
    hmrcResponse = await fetch(endpoint, fetchOptions);
    if (isRetryable(hmrcResponse.status)) {
      await sleep(hmrcResponse.status === 429
        ? HMRC_CONFIG.timing.retryDelayRateLimitSecondMs
        : HMRC_CONFIG.timing.retryDelayServerErrorSecondMs);
      hmrcResponse = await fetch(endpoint, fetchOptions);
    }
  }

  return hmrcResponse;
}
