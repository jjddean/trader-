/**
 * Base origin for magic-link URLs (consultant / end-user review).
 *
 * Local/dev: use the request (or APP_URL) host so the link hits the same
 * Convex deployment that created the token — never force production.
 *
 * Production emails: Resend Deliverability Insights wants link hosts to match
 * the From domain (e.g. `@freightcode.co.uk` → `https://freightcode.co.uk`).
 *
 * @see https://resend.com/docs/dashboard/emails/deliverability-insights
 */

function isLocalHost(hostnameOrOrigin: string): boolean {
  let host = hostnameOrOrigin.toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
    else host = host.split(":")[0] ?? "";
  } catch {
    host = host.split(":")[0] ?? "";
  }
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".local");
}

function originFromUrl(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function requestOrigin(request?: Request): string | null {
  if (!request) return null;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (isLocalHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function emailLinkBaseUrl(request?: Request): string {
  const fromRequest = requestOrigin(request);
  if (fromRequest && isLocalHost(fromRequest)) {
    return fromRequest;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const configuredOrigin = originFromUrl(configured) ?? configured.replace(/\/$/, "");
    if (isLocalHost(configuredOrigin)) {
      return configuredOrigin;
    }
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const sendingHost = from.match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase();
  if (sendingHost && sendingHost !== "resend.dev") {
    return `https://${sendingHost}`;
  }

  if (configured) {
    return originFromUrl(configured) ?? configured.replace(/\/$/, "");
  }

  if (fromRequest) return fromRequest;

  return "https://freightcode.co.uk";
}

export function emailPathUrl(path: string, request?: Request): string {
  const base = emailLinkBaseUrl(request).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
