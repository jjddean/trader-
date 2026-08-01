/**
 * Base origin for magic-link URLs (consultant / end-user review).
 *
 * Local/dev: use the request (or APP_URL) host so the link hits the same
 * Convex deployment that created the token — never force production.
 *
 * Production emails: prefer NEXT_PUBLIC_APP_URL (Clerk allowlist / www canonical).
 * Falls back to Resend From host when APP_URL is unset.
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

  // Prefer explicit app URL (Clerk allowlist / www canonical) over Resend From host.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return originFromUrl(configured) ?? configured.replace(/\/$/, "");
  }

  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const sendingHost = from.match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase();
  if (sendingHost && sendingHost !== "resend.dev") {
    return `https://${sendingHost}`;
  }

  if (fromRequest) return fromRequest;

  return "https://www.freightcode.co.uk";
}

export function emailPathUrl(path: string, request?: Request): string {
  const base = emailLinkBaseUrl(request).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
