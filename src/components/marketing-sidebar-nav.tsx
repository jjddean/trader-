"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const marketingNav = [
  {
    group: "Platform",
    pages: [
      { title: "Solutions", href: "/solutions" },
      { title: "Docs", href: "/docs" },
    ],
  },
  {
    group: "Company",
    pages: [
      { title: "About", href: "/about" },
      { title: "Contact", href: "/contact" },
    ],
  },
];

export function MarketingSidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-52 shrink-0 md:block">
      <nav className="sticky top-24 space-y-7">
        {marketingNav.map((section) => (
          <div key={section.group}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.pages.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className={cn(
                      "block py-1.5 text-[14px] transition-colors",
                      pathname === page.href || pathname.startsWith(`${page.href}/`)
                        ? "font-medium text-slate-900"
                        : "text-slate-600 hover:text-slate-900",
                    )}
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
  );
}
