import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface DocsSiteHeaderProps {
  badge: string;
}

export function DocsSiteHeader({ badge }: DocsSiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
          <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
            <span className="text-xl font-bold tracking-tight">freight</span>
            <span className="text-xl font-bold tracking-tight text-slate-600">code</span>
            <span className="ml-[-1px] -translate-y-[5px] text-[13px] font-normal text-slate-600">®</span>
          </div>
          <span className="ml-2 hidden rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600 sm:inline-block">
            {badge}
          </span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back to Home</span>
        </Link>
      </div>
    </header>
  );
}

export function DocsSiteFooter() {
  return (
    <footer className="mt-auto w-full border-t border-slate-200 bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-5 flex justify-center">
          <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
            <span className="text-[22px] font-bold tracking-tight">freight</span>
            <span className="text-[22px] font-bold tracking-tight text-slate-600">code</span>
            <span className="ml-[-1px] -translate-y-[5px] text-[13px] font-normal text-slate-600">®</span>
          </div>
        </div>
        <p className="mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-slate-600">
          UK customs declarations through HMRC CDS — draft, validate, submit, and keep audit-ready records.
        </p>
        <div className="inline-flex min-w-[280px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="mb-2 text-[16px] font-bold text-slate-900">Need direct support?</span>
          <a
            href="mailto:info@freightcode.co.uk"
            className="text-[16px] font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline"
          >
            info@freightcode.co.uk
          </a>
          <span className="mt-2 text-[13px] font-medium text-slate-500">London, UK</span>
        </div>
        <p className="mt-12 text-[13px] font-medium text-slate-400">
          © {new Date().getFullYear()} Freightcode. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
