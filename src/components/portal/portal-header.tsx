"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PortalHeaderProps {
  title: string;
  badge?: string;
  className?: string;
}

export function PortalHeader({ title, badge = "PORTAL", className }: PortalHeaderProps) {
  return (
    <header
      className={cn(
        "z-[60] flex h-[55px] shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-slate-50 px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <SidebarTrigger className="-ml-1 size-5 [&_svg]:size-2.5 [&_svg]:stroke-[1.5]" />
        <div className="flex min-w-0 items-center gap-2">
          {/* Chrome, not the document heading — each page renders its own h1. */}
          <p className="truncate text-sm font-medium text-black">{title}</p>
          <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide text-slate-600 uppercase">
            {badge}
          </span>
        </div>
      </div>
    </header>
  );
}
