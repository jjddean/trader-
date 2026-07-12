import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const to = process.argv[2] || process.env.COMPLIANCE_CONSULTANT_DEFAULT_EMAIL || "jasondeanfitness@outlook.com";
const key = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL || "Freightcode <onboarding@resend.dev>";

if (!key) {
  console.error("RESEND_API_KEY missing");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "Freightcode — consultant review test",
    html: `<p>Test email for consultant dispatch.</p><p>If you received this, Resend is working for <strong>${to}</strong>.</p>`,
  }),
});

const body = await res.text();
console.log(res.status, body);
