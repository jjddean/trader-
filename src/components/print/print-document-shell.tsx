"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { triggerBrowserPrint } from "@/lib/print-sheet";

interface PrintDocumentShellProps {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function PrintDocumentShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
}: PrintDocumentShellProps) {
  return (
    <div className="min-h-screen bg-white">
      <div className="print:hidden sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <button
            type="button"
            onClick={triggerBrowserPrint}
            className="inline-flex items-center gap-2 rounded-md bg-black px-4 py-2 text-xs font-medium text-white transition-opacity hover:bg-gray-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
        <header className="mb-8 border-b border-gray-200 pb-6 print:mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-gray-500">{subtitle}</p> : null}
        </header>
        {children}
      </article>
    </div>
  );
}

function PrintField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{value || "N/A"}</p>
    </div>
  );
}

export { PrintField };
