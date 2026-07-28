import type { ReactNode } from "react";
import {
  Building2,
  FileText,
  Landmark,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

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
            freightcode.co.uk/dashboard/records
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

const rows = [
  {
    mrn: "26GB86AMY27INDXAR5",
    date: "25 Jul 2026",
    method: "HMRC assessed",
    source: "hmrc" as const,
    amount: "£1,100.00",
  },
  {
    mrn: "26GB86AMY27INDXAR5",
    date: "25 Jul 2026",
    method: "Estimated — not on declaration",
    source: "estimate" as const,
    amount: "£1,650.00",
  },
  {
    mrn: "26GB7KQ8N41PLMZW2",
    date: "22 Jul 2026",
    method: "HMRC assessed",
    source: "hmrc" as const,
    amount: "£890.00",
  },
];

export function FinancialRecordsPreview() {
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
              <div className="rounded-md px-2 py-1.5">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-slate-900">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  Compliance
                </div>
                <div className="ml-3 space-y-0.5 border-l border-slate-200 pl-2 text-[9px]">
                  <div className="text-slate-500">Trade Compliance</div>
                  <div className="font-medium text-slate-900">Financial Records</div>
                  <div className="text-slate-500">Customs Reports</div>
                  <div className="text-slate-500">Import TRE</div>
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

        <div className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Total duty paid
                </p>
                <Landmark className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[18px] font-bold tracking-tight text-slate-900">£240.00</p>
              <p className="mt-1 text-[9px] text-slate-500">Estimated until HMRC confirms duty and VAT</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  Import VAT (B00)
                </p>
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <p className="mt-1 text-[18px] font-bold tracking-tight text-slate-900">£27,698.00</p>
              <p className="mt-1 text-[9px] text-slate-500">
                £22,100.00 confirmed by HMRC · £5,598.00 estimated
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-400">
            <Search className="h-3 w-3" />
            Search by MRN, Date, Tax Type, or Payment Method...
          </div>

          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-[9px]">
              <thead className="border-b border-slate-100 bg-slate-50 text-[8px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-2.5 py-2">Declaration MRN</th>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2">Tax type</th>
                  <th className="px-2.5 py-2">Payment method</th>
                  <th className="px-2.5 py-2">Source</th>
                  <th className="px-2.5 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.mrn}-${i}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-2.5 py-2 font-medium text-slate-800">{row.mrn}</td>
                    <td className="px-2.5 py-2 text-slate-600">{row.date}</td>
                    <td className="px-2.5 py-2">
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-700">
                        Import VAT (B00)
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-slate-600">{row.method}</td>
                    <td className="px-2.5 py-2">
                      {row.source === "hmrc" ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
                          HMRC
                        </span>
                      ) : (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
                          Estimate
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold text-slate-900">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
