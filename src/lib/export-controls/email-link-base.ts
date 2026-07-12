/**
 * Base origin for links inside Resend emails.
 *
 * Resend Deliverability Insights requires link hosts to match the From domain
 * (e.g. `@freightcode.co.uk` → `https://freightcode.co.uk`, not `www`).
 *
 * @see https://resend.com/docs/dashboard/emails/deliverability-insights
 */
export function emailLinkBaseUrl(request?: Request): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  const sendingHost = from.match(/@([A-Za-z0-9.-]+)/)?.[1]?.toLowerCase();

  if (sendingHost && sendingHost !== "resend.dev") {
    return `https://${sendingHost}`;
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured.replace(/\/$/, "");
    }
  }

  if (request) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  }

  return "https://freightcode.co.uk";
}

export function emailPathUrl(path: string, request?: Request): string {
  const base = emailLinkBaseUrl(request).replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
