import type { ReactNode } from "react";
import {
  Building2, ChevronRight, FileText, FolderOpen, LayoutDashboard,
  MessageSquare, PoundSterling, ShieldCheck, Upload,
} from "lucide-react";

function PreviewFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-full" style={{ containerType: "inline-size" }}>
      <div className="overflow-hidden rounded-[16px] border border-[#dbe4f0] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.1)]"
        style={{ width: 860, zoom: "min(1, calc(100cqw / 860px))" }}>
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          <div className="ml-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-500">
            freightcode.co.uk/portal/dashboard
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

const nav = [
  [LayoutDashboard, "Home"], [FileText, "Declarations"], [FolderOpen, "Documents"],
  [PoundSterling, "Charges"], [ShieldCheck, "Export controls"],
  [MessageSquare, "Messages"], [Building2, "Company"],
] as const;

const declarations = [
  ["26GB86AMY27INDXAR5", "2 Aug 2026", "Cleared", "bg-emerald-50 text-emerald-700"],
  ["26GB7KQ8N41PLMZW2", "1 Aug 2026", "Processing", "bg-blue-50 text-blue-700"],
] as const;

export function ClientPortalPreview() {
  return (
    <PreviewFrame>
      <div className="grid grid-cols-[150px_minmax(0,1fr)] bg-[#f8fafc]">
        <aside className="flex flex-col border-r border-slate-200 bg-white">
          <div className="flex h-11 items-center border-b border-slate-200 px-4">
            <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
              <span className="text-[14px] font-bold tracking-tight">freight</span>
              <span className="text-[14px] font-bold tracking-tight text-slate-500">code</span>
              <span className="-translate-y-1 text-[7px] text-slate-400">®</span>
            </div>
          </div>
          <div className="flex-1 px-2.5 py-3">
            <p className="mb-1.5 px-2 text-[8px] uppercase tracking-[0.16em] text-slate-400">Client portal</p>
            <nav className="space-y-0.5">
              {nav.map(([Icon, label], index) => (
                <div key={label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${index === 0 ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500"}`}>
                  <Icon className="h-3 w-3 text-slate-400" />{label}
                </div>
              ))}
            </nav>
          </div>
          <div className="m-2 rounded-md border border-slate-200 px-2 py-2">
            <p className="truncate text-[9px] font-medium text-slate-700">Atlas Trading GmbH</p>
            <p className="mt-0.5 text-[8px] text-slate-400">Secure portal access</p>
          </div>
        </aside>

        <main>
          <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-white px-4">
            <div><p className="text-[11px] font-semibold text-slate-900">Home</p>
              <p className="text-[8px] text-slate-400">Your UK customs activity</p></div>
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[9px] font-semibold text-white">AT</div>
          </div>
          <div className="p-4">
            <h3 className="text-[16px] font-semibold tracking-tight text-slate-900">Good afternoon, Atlas Trading GmbH</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">Here&apos;s what needs you today.</p>

            <section className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-2.5"><h4 className="text-[11px] font-medium text-slate-900">Needs your attention</h4></div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50"><Upload className="h-3.5 w-3.5 text-amber-700" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-slate-900">Commercial invoice required</p>
                  <p className="text-[9px] text-slate-500">Upload the document for declaration 26GB7KQ8N41PLMZW2</p>
                </div>
                <span className="rounded-md bg-slate-900 px-2.5 py-1 text-[9px] font-medium text-white">Upload</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
              </div>
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <h4 className="text-[11px] font-medium text-slate-900">Recent declarations</h4>
                <span className="text-[9px] font-medium text-slate-500">View all</span>
              </div>
              {declarations.map(([mrn, date, status, tone]) => (
                <div key={mrn} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <div className="min-w-0 flex-1"><p className="font-mono text-[9px] font-semibold text-slate-900">{mrn}</p>
                    <p className="text-[8px] text-slate-500">Import declaration · {date}</p></div>
                  <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${tone}`}>{status}</span>
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                </div>
              ))}
            </section>
          </div>
        </main>
      </div>
    </PreviewFrame>
  );
}
