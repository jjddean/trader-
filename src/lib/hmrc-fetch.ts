const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const encodeValue = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

export async function fetchHmrc(
  endpoint: string, 
  options: RequestInit, 
  req: Request, 
  token: string
) {
  // Extract client IP
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  const clientPort = req.headers.get("x-forwarded-port") || "443";
  const vendorPublicIp = process.env.HMRC_VENDOR_PUBLIC_IP || "203.0.113.6";
  
  // Base server-side HMRC headers
  const govHeaders: Record<string, string> = {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Version": "TradeDNA=1.0.0",
    "Gov-Vendor-Product-Name": encodeValue("TradeDNA"),
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
    Accept: process.env.HMRC_DECLARATIONS_ACCEPT || "application/vnd.hmrc.1.0+xml",
    Authorization: `Bearer ${token}`,
    "X-Client-ID": process.env.HMRC_CLIENT_ID || "",
    ...govHeaders,
    ...(options.headers as Record<string, string>),
  };

  // DEBUG LOGGING
  const maskedToken = (token || "").substring(0, 8) + "..." + (token || "").slice(-4);
  console.log(`[HMRC REQUEST] ${options.method} ${endpoint}`);
  console.log(`[HMRC HEADERS] X-Client-ID: ${hmrcHeaders["X-Client-ID"]}`);
  console.log(`[HMRC HEADERS] Authorization: Bearer ${maskedToken}`);
  console.log(`[HMRC HEADERS] Accept: ${hmrcHeaders["Accept"]}`);

  if (testScenario) {
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
    const delay = hmrcResponse.status === 429 ? 2000 : 1000;
    await sleep(delay);
    hmrcResponse = await fetch(endpoint, fetchOptions);
    if (isRetryable(hmrcResponse.status)) {
      await sleep(hmrcResponse.status === 429 ? 5000 : 3000);
      hmrcResponse = await fetch(endpoint, fetchOptions);
    }
  }

  return hmrcResponse;
}
