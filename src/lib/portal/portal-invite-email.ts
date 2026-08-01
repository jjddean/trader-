/**
 * Portal invite email via Resend.
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface PortalInviteEmailInput {
  to: string;
  clientName: string;
  brokerName?: string;
  portalUrl: string;
  signInUrl: string;
  /** First-time clients create a Clerk account, then land on /portal. */
  signUpUrl: string;
}

export async function sendPortalInviteEmail(input: PortalInviteEmailInput): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }
  if (!from) {
    return { sent: false, reason: "RESEND_FROM_EMAIL not configured (must be a verified domain address)" };
  }

  const brokerLabel = input.brokerName?.trim() || "Your customs broker";
  const subject = `Client portal access — ${input.clientName}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px">
      <p style="font-size:14px;font-weight:600">FreightCode client portal</p>
      <p style="font-size:13px;color:#475569">
        ${escapeHtml(brokerLabel)} has enabled read-only portal access for
        <strong>${escapeHtml(input.clientName)}</strong> so you can view customs declarations
        filed on your behalf.
      </p>
      <p style="font-size:13px;color:#475569">
        Use this email address (<strong>${escapeHtml(input.to)}</strong>).
        If you do not have an account yet, create one first — then you can sign in any time.
      </p>
      <p style="margin:24px 0">
        <a href="${escapeAttr(input.signUpUrl)}" style="background:#111827;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;display:inline-block">
          Create account &amp; open portal
        </a>
      </p>
      <p style="font-size:12px;color:#475569;margin:0">
        Already have an account?
        <a href="${escapeAttr(input.signInUrl)}" style="color:#0f172a;font-weight:600">Sign in</a>
      </p>
      <p style="font-size:11px;color:#94a3b8">
        Bookmark: ${escapeHtml(input.portalUrl)}
      </p>
      <p style="font-size:11px;color:#94a3b8">
        This is a read-only view of declarations, documents, duty/VAT estimates, and messages with your broker.
        FreightCode does not submit licence applications to government on your behalf.
      </p>
    </div>
  `;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { sent: false, reason: body || `Resend error ${res.status}` };
  }

  return { sent: true };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
