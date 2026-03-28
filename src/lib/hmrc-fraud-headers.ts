export interface HmrcFraudHeaders {
  "Gov-Client-Timezone": string;
  "Gov-Client-Window-Size": string;
  "Gov-Client-Screens": string;
  "Gov-Client-Browser-JS-User-Agent": string;
  "Gov-Client-Browser-Do-Not-Track": string;
  "Gov-Client-Local-IPs": string;
  [key: string]: string;
}

export function generateClientFraudHeaders(): HmrcFraudHeaders {
  if (typeof window === "undefined") {
    return {} as HmrcFraudHeaders;
  }

  const tzOffset = new Date().getTimezoneOffset();
  const tzHours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const tzMins = String(Math.abs(tzOffset) % 60).padStart(2, '0');
  const tzSign = tzOffset > 0 ? '-' : '+';
  
  return {
    "Gov-Client-Timezone": `UTC${tzSign}${tzHours}:${tzMins}`,
    "Gov-Client-Window-Size": `width=${window.innerWidth}&height=${window.innerHeight}`,
    "Gov-Client-Screens": `width=${window.screen.width}&height=${window.screen.height}&scaling-factor=${window.devicePixelRatio}&colour-depth=${window.screen.colorDepth}`,
    "Gov-Client-Browser-JS-User-Agent": navigator.userAgent,
    "Gov-Client-Browser-Do-Not-Track": navigator.doNotTrack === "1" ? "true" : "false",
    "Gov-Client-Local-IPs": ""
  };
}
