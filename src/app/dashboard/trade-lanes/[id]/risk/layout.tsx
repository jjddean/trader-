"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const sections = [
  { slug: "", label: "Overview" },
  { slug: "/global-map", label: "Global Map" },
  { slug: "/assets", label: "Assets" },
  { slug: "/intel-feed", label: "Intel Feed" },
];

export default function TradeLaneRiskLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const basePath = `/dashboard/trade-lanes/${id}/risk`;

  return (
    <div className="space-y-4">
      <nav className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {sections.map((section) => {
          const href = `${basePath}${section.slug}`;
          return (
            <Link
              key={section.label}
              href={href}
              className={cn(
                "rounded-md px-3 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
                pathname === href && "bg-slate-100 text-slate-900",
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
