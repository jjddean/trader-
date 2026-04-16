export interface HmrcFraudHeaders {
  "Gov-Client-Timezone": string;
  "Gov-Client-Window-Size": string;
  "Gov-Client-Screens": string;
  "Gov-Client-Browser-JS-User-Agent": string;
  "Gov-Client-Browser-Do-Not-Track": string;
  // Gov-Client-Local-IPs intentionally omitted — not required for WEB_APP_VIA_SERVER and 127.0.0.1/private IPs trigger HMRC WAF (PAYLOAD_FORBIDDEN)
  "Gov-Client-Device-ID": string;
  "Gov-Client-User-IDs": string;
  "Gov-Client-Multi-Factor": string;
  "Gov-Client-Browser-Plugins": string;
  "Gov-Client-User-Agent": string;
  [key: string]: string;
}

function getOrCreateDeviceId() {
  const storageKey = "hmrc_device_id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }
  const created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(storageKey, created);
  return created;
}

function encodeValue(value: string) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

export function generateClientFraudHeaders(userIdentifier?: string): HmrcFraudHeaders {
  if (typeof window === "undefined") {
    return {} as HmrcFraudHeaders;
  }

  const tzOffset = new Date().getTimezoneOffset();
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const tzSign = tzOffset > 0 ? '-' : '+';
  
  const nowIso = new Date().toISOString();
  const userIdValue = userIdentifier?.trim() || "anonymous";
  const plugins = Array.from(window.navigator.plugins || [])
    .map((p) => p.name)
    .filter(Boolean)
    .slice(0, 20);
  const pluginsValue = plugins.length > 0
    ? plugins.map((name) => encodeValue(name)).join(",")
    : "none";

  return {
    "Gov-Client-Timezone": `UTC${tzSign}${tzHours}:${tzMins}`,
    "Gov-Client-Window-Size": `width=${window.innerWidth}&height=${window.innerHeight}`,
    "Gov-Client-Screens": `width=${window.screen.width}&height=${window.screen.height}&scaling-factor=${window.devicePixelRatio}&colour-depth=${window.screen.colorDepth}`,
    "Gov-Client-Browser-JS-User-Agent": navigator.userAgent,
    "Gov-Client-Browser-Do-Not-Track": navigator.doNotTrack === "1" ? "true" : "false",
    // Gov-Client-Local-IPs: omitted for WEB_APP_VIA_SERVER — loopback/private IPs trip the HMRC WAF
    "Gov-Client-Device-ID": getOrCreateDeviceId(),
    "Gov-Client-User-IDs": `appUser=${encodeValue(userIdValue)}`,
    "Gov-Client-Multi-Factor": `type=OTHER&timestamp=${encodeValue(nowIso)}&unique-reference=${encodeValue(`session-${userIdValue}`)}`,
    "Gov-Client-Browser-Plugins": pluginsValue,
    "Gov-Client-User-Agent": navigator.userAgent
  };
}
