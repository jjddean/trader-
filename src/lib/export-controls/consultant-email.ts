const RESEND_API_URL = "https://api.resend.com/emails";

export interface ConsultantDispatchEmailInput {
  to: string;
  consultantName?: string;
  assessmentReference: string;
  destinationCountry?: string;
  status: string;
  senderName?: string;
  senderNote?: string;
  reviewUrl: string;
  expiresAt: number;
}

export async function sendConsultantReviewEmail(input: ConsultantDispatchEmailInput): Promise<{
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

  const expiry = new Date(input.expiresAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const subject = `Export assessment ${input.assessmentReference} — review requested`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px">
      <p style="font-size:14px;font-weight:600">Export control review requested</p>
      <p style="font-size:13px;color:#475569">
        ${input.senderName ? `${input.senderName} has` : "A Freightcode user has"} shared assessment
        <strong>${input.assessmentReference}</strong> for your review.
      </p>
      <table style="font-size:12px;color:#334155;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Status</td><td>${input.status}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Destination</td><td>${input.destinationCountry ?? "—"}</td></tr>
      </table>
      ${
        input.senderNote
          ? `<p style="font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px">${escapeHtml(input.senderNote)}</p>`
          : ""
      }
      <p style="margin:24px 0">
        <a href="${input.reviewUrl}" style="background:#111827;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;display:inline-block">
          Open assessment packet
        </a>
      </p>
      <p style="font-size:11px;color:#94a3b8">
        Link expires ${expiry}. This packet is shared for review only — Freightcode does not submit to government systems.
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
