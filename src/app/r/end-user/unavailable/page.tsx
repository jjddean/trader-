import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
  referrer: "no-referrer",
};

export default function EndUserStatementUnavailablePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-slate-900">This form is not available</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          The link has already been used, has expired, or was withdrawn. Ask the sender for a new request.
        </p>
      </div>
    </div>
  );
}
