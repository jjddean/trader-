const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchHmrc(
  endpoint: string, 
  options: RequestInit, 
  req: Request, 
  token: string
) {
  // Extract client IP
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  
  // Base server-side HMRC headers
  const govHeaders: Record<string, string> = {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Version": "TradeDNA=1.0.0",
    "Gov-Vendor-Product-Name": "TradeDNA",
    "Gov-Client-Public-IP": clientIp.split(",")[0].trim(),
    "Gov-Client-Public-IP-Timestamp": new Date().toISOString()
  };

  // Client-sourced headers that must be forwarded from the NextJS API request
  const clientHeaders = [
    "Gov-Client-Timezone",
    "Gov-Client-Window-Size",
    "Gov-Client-Screens",
    "Gov-Client-Browser-JS-User-Agent",
    "Gov-Client-Browser-Do-Not-Track",
    "Gov-Client-Local-IPsTimestamp"
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

  if (testScenario) {
    hmrcHeaders["Gov-Test-Scenario"] = testScenario;
  }

  const fetchOptions = {
    ...options,
    headers: hmrcHeaders,
  };

  let hmrcResponse = await fetch(endpoint, fetchOptions);

  // Standardised Retry limit for HTTP 429 Rate Limits
  if (hmrcResponse.status === 429) {
    await sleep(2000);
    hmrcResponse = await fetch(endpoint, fetchOptions);
    if (hmrcResponse.status === 429) {
      await sleep(5000);
      hmrcResponse = await fetch(endpoint, fetchOptions);
    }
  }

  return hmrcResponse;
}
