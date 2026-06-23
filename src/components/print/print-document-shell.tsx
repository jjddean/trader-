"use client";

export function PrintDocumentHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-8 border-b border-slate-200 pb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
    </header>
  );
}

function PrintField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{value || "N/A"}</p>
    </div>
  );
}

export { PrintField };
