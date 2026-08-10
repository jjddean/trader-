import Link from "next/link";
import { DocsSiteFooter, DocsSiteHeader } from "@/components/docs-chrome";

const docsNav = [
  {
    group: "Getting Started",
    pages: [
      { title: "Introduction", href: "/docs" },
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
    <div className="flex min-h-screen flex-col">
      <DocsSiteHeader badge="Docs" />

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-12 px-6 py-10">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-24 space-y-7">
            {docsNav.map((section) => (
              <div key={section.group}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {section.group}
                </p>
                <ul className="space-y-0.5">
                  {section.pages.map((page) => (
                    <li key={page.href}>
                      <Link
                        href={page.href}
                        className="block py-1.5 text-[14px] text-slate-600 transition-colors hover:text-slate-900"
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

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <DocsSiteFooter />
    </div>
  );
}
