const RESEND_API_URL = "https://api.resend.com/emails";

export interface EndUserDispatchEmailInput {
  to: string;
  assessmentReference: string;
  destinationCountry?: string;
  productSummary?: string;
  senderNote?: string;
  formUrl: string;
  expiresAt: number;
}

export async function sendEndUserStatementEmail(input: EndUserDispatchEmailInput): Promise<{
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

  const subject = `End-user and stockist undertaking (EUSU) requested — ${input.assessmentReference}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px">
      <p style="font-size:14px;font-weight:600">End-user and stockist undertaking (EUSU) requested</p>
      <p style="font-size:13px;color:#475569">
        Your export compliance adviser has asked you to complete an end-user and stockist undertaking for shipment
        <strong>${escapeHtml(input.assessmentReference)}</strong>.
      </p>
      <table style="font-size:12px;color:#334155;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Destination</td><td>${escapeHtml(input.destinationCountry ?? "—")}</td></tr>
        ${input.productSummary ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Goods</td><td>${escapeHtml(input.productSummary)}</td></tr>` : ""}
      </table>
      ${
        input.senderNote
          ? `<p style="font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:6px">${escapeHtml(input.senderNote)}</p>`
          : ""
      }
      <p style="margin:24px 0">
        <a href="${input.formUrl}" style="background:#111827;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;display:inline-block">
          Complete EUSU
        </a>
      </p>
      <p style="font-size:11px;color:#94a3b8">Link expires ${expiry}.</p>
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

export interface EusuSubmittedEmailInput {
  to: string;
  assessmentReference: string;
  destinationCountry?: string;
  endUserName?: string;
  signedBy?: string;
  assessmentUrl: string;
}

/** Notifies the sender (exporter or consultant) that the buyer completed the EUSU. */
export async function sendEusuSubmittedEmail(input: EusuSubmittedEmailInput): Promise<{
  sent: boolean;
  reason?: string;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY not configured" };
  if (!from) return { sent: false, reason: "RESEND_FROM_EMAIL not configured" };

  const subject = `EUSU completed — ${input.assessmentReference}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px">
      <p style="font-size:14px;font-weight:600">End-user and stockist undertaking completed</p>
      <p style="font-size:13px;color:#475569">
        The undertaking for assessment <strong>${escapeHtml(input.assessmentReference)}</strong> has been submitted.
      </p>
      <table style="font-size:12px;color:#334155;margin:16px 0">
        ${input.endUserName ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">End user</td><td>${escapeHtml(input.endUserName)}</td></tr>` : ""}
        ${input.signedBy ? `<tr><td style="padding:4px 12px 4px 0;color:#64748b">Signed by</td><td>${escapeHtml(input.signedBy)}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Destination</td><td>${escapeHtml(input.destinationCountry ?? "—")}</td></tr>
      </table>
      <p style="margin:24px 0">
        <a href="${input.assessmentUrl}" style="background:#111827;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600;display:inline-block">
          Open the draft pack
        </a>
      </p>
      <p style="font-size:11px;color:#94a3b8">Download the completed undertaking from the EUSU card on the Draft pack tab.</p>
    </div>
  `;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject, html }),
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
