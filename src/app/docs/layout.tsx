import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const docsNav = [
  {
    group: "Getting Started",
    pages: [
      { title: "Introduction", href: "/docs/introduction" },
      { title: "Quickstart", href: "/docs/quickstart" },
    ],
  },
  {
    group: "HMRC CDS",
    pages: [
      { title: "Connect HMRC", href: "/docs/hmrc/connect" },
      { title: "Declarations", href: "/docs/hmrc/declarations" },
      { title: "Supporting Documents", href: "/docs/hmrc/documents" },
    ],
  },
  {
    group: "Compliance",
    pages: [
      { title: "Compliance Audit", href: "/docs/compliance/audit" },
      { title: "HS Code Lookup", href: "/docs/compliance/hs-codes" },
    ],
  },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="w-full border-b border-slate-200/50 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex h-[64px] max-w-[1280px] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="text-xl font-bold tracking-tight">freight</span>
              <span className="text-xl font-bold tracking-tight text-slate-600">code</span>
              <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
            </div>
            <span className="ml-2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600 hidden sm:inline-block">
              Docs
            </span>
          </Link>
          <Link href="/" className="text-[14px] font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1.5 transition-colors">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 mx-auto w-full max-w-[1280px] px-6 py-10 gap-12">
        <aside className="hidden md:block w-52 shrink-0">
          <nav className="sticky top-24 space-y-7">
            {docsNav.map((section) => (
              <div key={section.group}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.pages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block text-[14px] text-slate-600 hover:text-slate-900 py-1.5 transition-colors"
                      >
                        {page.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      <footer className="py-12 px-6 bg-slate-50 border-t border-slate-200 w-full mt-auto">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-5">
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="font-bold tracking-tight text-[22px]">freight</span>
              <span className="font-bold tracking-tight text-[22px] text-slate-600">code</span>
              <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
            </div>
          </div>
          <p className="text-slate-600 text-[15px] mb-8 max-w-lg mx-auto leading-relaxed">
            UK customs declarations through HMRC CDS — draft, validate, submit, and keep audit-ready records.
          </p>
          <div className="inline-flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 p-6 shadow-sm min-w-[280px]">
            <span className="text-[16px] font-bold text-slate-900 mb-2">Need direct support?</span>
            <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:text-blue-700 hover:underline text-[16px] font-semibold transition-colors">
              info@freightcode.co.uk
            </a>
            <span className="text-[13px] text-slate-500 mt-2 font-medium">London, UK</span>
          </div>
          <p className="text-slate-400 text-[13px] mt-12 font-medium">
            © {new Date().getFullYear()} Freightcode. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
