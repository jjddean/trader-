import type { ReactNode } from "react";
import {
  FileText,
  LayoutDashboard,
  Paperclip,
  Play,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

const tabs = [
  "Overview",
  "Documents",
  "Export Controls",
  "Sanctions",
  "Licence management",
  "Audit Log",
] as const;

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full" style={{ containerType: "inline-size" }}>
      <div
        className="overflow-hidden rounded-[16px] border border-[#dbe4f0] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.1)]"
        style={{
          width: 860,
          zoom: "min(1, calc(100cqw / 860px))",
        }}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          <div className="ml-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-500">
            freightcode.co.uk/dashboard/trade-compliance
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ClassificationPanel() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-[13px] font-semibold text-slate-900">Control entry classification</h4>
      <p className="mt-1 text-[10px] text-slate-500">
        Select a product, run Classify, then approve one control entry — all in the same panel.
      </p>
      <div className="mt-4 grid gap-3 grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            Products (1)
          </div>
          <div className="bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium text-slate-900">Industrial centrifugal pump</p>
            <span className="mt-1.5 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
              0B004
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-[12px] font-semibold text-slate-900">Industrial centrifugal pump</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Industrial Pumps GmbH</p>
          <p className="mt-2 text-[10px] text-slate-600">
            Decision: <span className="font-semibold text-slate-900">0B004</span>
          </p>
          <div className="mt-4 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 text-[11px] font-medium text-white">
            <Play className="h-3 w-3 fill-current" />
            Classify
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
            Click Classify to find control entry candidates for this product.
          </p>
        </div>
      </div>
    </div>
  );
}

export function TradeCompliancePreview() {
  return (
    <PreviewFrame>
      <div className="grid grid-cols-[140px_minmax(0,1fr)] bg-[#f8fafc]">
        <aside className="flex flex-col border-r border-slate-200 bg-slate-50">
          <div className="flex h-10 items-center border-b border-slate-200 px-3">
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="text-[13px] font-bold tracking-tight">freight</span>
              <span className="text-[13px] font-bold tracking-tight text-slate-500">code</span>
            </div>
          </div>
          <div className="flex-1 px-2.5 py-2">
            <div className="mb-2 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-400">
              <Search className="h-2.5 w-2.5" />
              Search
            </div>
            <nav className="space-y-0.5 text-[10px]">
              <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500">
                <LayoutDashboard className="h-2.5 w-2.5" />
                Dashboard
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500">
                <FileText className="h-2.5 w-2.5" />
                Documents
              </div>
              <div className="rounded-md bg-white px-2 py-1.5 font-medium text-slate-900 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Trade Compliance
                </div>
              </div>
            </nav>
          </div>
          <div className="border-t border-slate-200 px-2.5 py-1.5 text-[9px] text-slate-500">
            <div className="flex items-center gap-1.5 px-2 py-1">
              <Settings className="h-2.5 w-2.5" />
              Settings
            </div>
          </div>
        </aside>

        <div>
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">EC-2026-46934</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">Export control assessment for this shipment</p>
                <span className="mt-1.5 inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-red-700">
                  Flagged
                </span>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-medium text-slate-700">
                  Print / save PDF
                </div>
                <div className="flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[9px] font-medium text-white">
                  <Paperclip className="h-2.5 w-2.5" />
                  Attach to Declaration
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-3 overflow-hidden text-[10px]">
              {tabs.map((tab) => (
                <span
                  key={tab}
                  className={
                    tab === "Export Controls"
                      ? "border-b-2 border-slate-900 pb-1.5 font-semibold text-slate-900"
                      : "pb-1.5 text-slate-500"
                  }
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
          <div className="p-3">
            <ClassificationPanel />
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
