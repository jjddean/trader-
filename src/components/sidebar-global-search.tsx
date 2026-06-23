"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { GlobalSearchOverlay } from "@/components/global-search-overlay";

export function SidebarGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <GlobalSearchOverlay isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Global Search"
          autoComplete="off"
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          readOnly
          className="focus:border-ring focus:ring-ring/50 h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white pr-3 pl-8 text-xs text-slate-700 transition-[color,box-shadow] outline-none focus:ring-2"
        />
      </div>
    </>
  );
}
