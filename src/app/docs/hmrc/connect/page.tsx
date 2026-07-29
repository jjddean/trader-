import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connect HMRC | freightcode® Docs",
  description: "How to connect your HMRC account to freightcode® via OAuth.",
};

export default function ConnectHmrcPage() {
  return (
    <article className="max-w-3xl py-4">
      <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600 mb-3">HMRC CDS</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4 leading-snug">
        Connect HMRC
      </h1>
      <p className="text-[16px] text-slate-600 leading-relaxed mb-10">
        freightcode® connects to HMRC&apos;s Customs Declaration Service via official OAuth 2.0. This gives the platform authority to submit declarations and receive notifications on your behalf — without storing your Government Gateway password.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Test environment (TDR)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        New organisations start in the <strong>test environment</strong>. Submissions go to HMRC&apos;s sandbox (TDR) only — not legally binding.
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>Open <strong>Settings → Security</strong> and copy your organisation&apos;s <strong>HMRC Test User</strong> credentials.</li>
        <li>Click <strong>Connect HMRC</strong> and sign in with those Test User credentials — <em>not</em> your live Government Gateway.</li>
        <li>Enter your <strong>real EORI</strong> and trade data on declaration forms.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Live CDS (production)</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        After production access is approved for your organisation, Connect HMRC uses your live Government Gateway account. Submissions are legally binding.
      </p>
      <ul className="list-disc pl-6 mb-6 space-y-2 text-[15px] text-slate-700">
        <li>A UK EORI number (format: GB + 12 digits)</li>
        <li>A Government Gateway account subscribed to the Customs Declaration Service</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">How to connect</h2>
      <ul className="space-y-4 mb-6 text-[15px] text-slate-700">
        <li><strong>1.</strong> Go to <strong>Settings → Security</strong> (test environment: copy Test User credentials first).</li>
        <li><strong>2.</strong> Click <strong>Connect HMRC</strong>.</li>
        <li><strong>3.</strong> Sign in on HMRC&apos;s page and grant freightcode® permission. Click <strong>Allow</strong>.</li>
        <li><strong>4.</strong> You are redirected back. The Dashboard shows <strong>HMRC Connected</strong> when authorised.</li>
      </ul>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Token expiry and refresh</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-4">
        HMRC access tokens expire after 4 hours. freightcode® checks the expiry before every submission — if the token has less than 5 minutes remaining, it is automatically refreshed using your stored refresh token before the declaration is sent.
      </p>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        The expiry date is shown on your Dashboard. If the token cannot be refreshed (e.g. your refresh token has also expired), the button will revert to <strong>Connect HMRC</strong> and you will need to re-authorise.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Disconnecting</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Click <strong>Disconnect</strong> on the Dashboard to remove your stored HMRC token. This does not affect any existing declarations or notifications already stored in freightcode®. To submit again you will need to reconnect.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 mt-8 mb-4">Sandbox vs Production</h2>
      <p className="text-[15px] text-slate-700 leading-relaxed mb-6">
        Test-environment organisations use HMRC&apos;s sandbox (TDR): Test User at Connect, real EORI on forms. Live organisations use production CDS and real Government Gateway — submissions clear goods at the border.
      </p>

      <div className="mt-12 p-8 bg-[#0f172a] rounded-2xl text-white">
        <h2 className="text-[18px] font-semibold mb-3">Connected — what&apos;s next?</h2>
        <p className="text-[14px] leading-relaxed text-slate-300 mb-6">
          With HMRC connected, you can create and submit declarations. See the Declarations guide for a full walkthrough.
        </p>
        <Link href="/docs/hmrc/declarations" className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-slate-900 hover:bg-slate-100 transition-colors">
          Declarations →
        </Link>
      </div>
    </article>
  );
}
