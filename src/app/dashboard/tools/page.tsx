"use client";

import Link from "next/link";
import { BookOpen, Globe, RotateCcw, Calculator, ArrowRight } from "lucide-react";

export default function ToolsHubPage() {
  const tools = [
    {
      title: "HS Code Lookup",
      href: "/dashboard/tools/hscode-lookup",
      description: "Search the official UK Global Tariff to find 6-10 digit commodity codes.",
      icon: <BookOpen className="h-5 w-5 text-[#787774]" />,
    },
  ];


  return (
    <div className="mx-auto flex h-full max-w-[800px] flex-col px-8 py-12">
      <div className="mb-10 border-b border-[#e9e9e7] pb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#37352f] mb-2">Customs Tools</h1>
        <p className="text-sm text-[#787774]">
          Standalone utilities and calculators to assist with your UK customs compliance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tools.map((tool, idx) => (
          <Link
            key={idx}
            href={tool.href}
            className="group flex flex-col justify-between rounded-[4px] border border-[#e9e9e7] bg-white p-6 shadow-sm transition-all hover:bg-gray-50 hover:border-gray-300"
          >
            <div>
              <div className="mb-4 inline-flex items-center justify-center rounded-md bg-gray-50 border border-gray-100 p-2">
                {tool.icon}
              </div>
              <h2 className="text-base font-semibold text-[#37352f] mb-2">
                {tool.title}
              </h2>
              <p className="text-xs text-[#787774] leading-relaxed">
                {tool.description}
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-semibold text-[#37352f] opacity-0 transition-opacity group-hover:opacity-100">
              Open Tool <ArrowRight className="ml-1 h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
