import {
  Bell,
  Compass,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";

const kpis = [
  {
    label: "Declarations",
    value: "184",
    detail: "14 updated in the last 24h",
    tone: "neutral",
  },
  {
    label: "Cleared",
    value: "91%",
    detail: "DMSCLE rate across live entries",
    tone: "success",
  },
  {
    label: "Flagged",
    value: "07",
    detail: "Rejections and audits needing review",
    tone: "warning",
  },
  {
    label: "Duty At Risk",
    value: "GBP 12.4k",
    detail: "Potential overpayment and reclaim value",
    tone: "info",
  },
];

const declarationRows = [
  {
    mrn: "24GB9X41A8CD12034",
    type: "IMD",
    updated: "3 mins ago",
    status: "Cleared",
    statusTone: "success",
  },
  {
    mrn: "24GB9X41A8CD12058",
    type: "IMD",
    updated: "11 mins ago",
    status: "Action Required",
    statusTone: "danger",
  },
  {
    mrn: "Draft Entry",
    type: "H1",
    updated: "26 mins ago",
    status: "Draft",
    statusTone: "neutral",
  },
];

const chartValues = [44, 76, 58, 92, 66, 84];
const timelineValues = [22, 58, 41, 77, 36, 69, 48, 84, 44, 72, 39, 66, 28, 63, 34, 79, 52, 74, 45, 70, 57, 82];
const hsCodeLabels = ["84", "39", "61", "94", "22", "73"];

function StatusPill({ tone, label }: { tone: string; label: string }) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";
  const dot =
    tone === "success" ? "bg-emerald-500" : tone === "danger" ? "bg-rose-500" : "bg-slate-500";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function HomeDashboardPreview() {
  return (
    <div className="relative mx-auto mt-8 max-w-[980px] lg:mt-10">
      <div className="absolute inset-x-12 -top-8 h-32 rounded-full bg-blue-200/25 blur-3xl" />
      <div className="relative max-h-[620px] overflow-hidden rounded-[22px] border border-[#dbe4f0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          <div className="ml-3 rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] text-gray-500">
            freightcode.co.uk/dashboard
          </div>
        </div>

        <div className="grid min-h-[540px] grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)]">
          <aside className="hidden border-r border-gray-200 bg-gray-50 lg:flex lg:flex-col">
            <div className="flex h-12 items-center border-b border-gray-200 px-4">
              <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                <span className="text-[16px] font-bold tracking-tight">freight</span>
                <span className="text-[16px] font-bold tracking-tight text-slate-500">code</span>
                <span className="ml-[-1px] -translate-y-[4px] text-[11px] font-normal text-slate-500">®</span>
              </div>
            </div>

            <div className="flex flex-1 flex-col px-3 py-2.5">
              <p className="mb-2 px-2 text-[9px] font-medium uppercase tracking-[0.2em] text-gray-400">
                Platform
              </p>
              <nav className="space-y-0.5">
                <div className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-[11px] text-black">
                  <LayoutDashboard className="h-3 w-3 text-gray-700" />
                  <span>Dashboard</span>
                </div>
                <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-gray-500">
                  <FileText className="h-3 w-3 text-gray-400" />
                  <span>Documents</span>
                </div>
                <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-gray-500">
                  <Compass className="h-3 w-3 text-gray-400" />
                  <span>Declarations</span>
                </div>
                <div className="rounded-md px-3 py-1.5 text-[11px] text-gray-500">
                  <div className="mb-1.5 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-gray-400" />
                    <span>Compliance</span>
                  </div>
                  <div className="ml-4 space-y-1.5 border-l border-gray-200 pl-3 text-[10px]">
                    <div className="text-gray-500">Audit</div>
                    <div className="font-medium text-black">Reports</div>
                    <div className="text-gray-500">HS Code Lookup</div>
                  </div>
                </div>
              </nav>

              <div className="mt-auto space-y-0.5 pt-4">
                <div className="flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] text-gray-500">
                  <HelpCircle className="h-3 w-3 text-gray-400" />
                  <span>User Guide</span>
                </div>
                <div className="flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] text-gray-500">
                  <Settings className="h-3 w-3 text-gray-400" />
                  <span>Settings</span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white">
                  JC
                </div>
                <div>
                  <p className="text-[11px] font-medium text-gray-700">Jason Clarke</p>
                  <p className="text-[9px] text-gray-400">Enterprise</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="bg-white">
            <div className="flex h-12 items-center justify-between border-b border-gray-200 px-4 md:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-4 w-px bg-gray-200" />
                <div className="truncate text-[13px] font-semibold text-black">Customs Dashboard</div>
                <span className="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-blue-600">
                  Sandbox
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 md:flex">
                  <Search className="h-3 w-3" />
                  <span>Global Search</span>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  HMRC
                </div>
                <button className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white">
                  <Bell className="h-3 w-3 text-gray-400" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-4.5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {kpis.map((item) => (
                  <div key={item.label} className="rounded-xl border border-[#e9e9e7] bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gray-500">
                        {item.label}
                      </p>
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          item.tone === "success"
                            ? "bg-green-500"
                            : item.tone === "warning"
                              ? "bg-amber-500"
                              : item.tone === "info"
                                ? "bg-blue-500"
                                : "bg-gray-300"
                        }`}
                      />
                    </div>
                    <div className="text-[22px] font-medium tracking-tight text-[#020817]">{item.value}</div>
                    <p className="mt-1 text-[10px] text-gray-500">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
                  <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/60 px-4 py-2.5">
                    <div>
                      <h4 className="text-[15px] font-medium text-black">Recent Declarations</h4>
                      <p className="text-[10px] text-gray-500">Tracked across linked HMRC activity</p>
                    </div>
                    <div className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600">
                      24h
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-gray-100">
                        <tr className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                          <th className="px-4 py-2.5">MRN / LRN</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Updated</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {declarationRows.map((row) => (
                        <tr key={row.mrn} className="hover:bg-gray-50/60">
                            <td className="px-4 py-3.5 text-[11px] font-semibold text-gray-900">{row.mrn}</td>
                            <td className="px-4 py-3.5 text-[11px] text-gray-500">{row.type}</td>
                            <td className="px-4 py-3.5 text-[11px] text-gray-500">{row.updated}</td>
                            <td className="px-4 py-3.5">
                              <StatusPill tone={row.statusTone} label={row.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
                  <div className="border-b border-gray-200 bg-gray-50/60 px-4 py-2.5">
                    <h4 className="text-[15px] font-medium text-black">Duty by HS Code</h4>
                  </div>
                  <div className="px-4 pb-4 pt-5">
                    <div className="relative h-[132px] rounded-lg border border-gray-100 bg-gray-50/40 p-3">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                        <polyline
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="2.25"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          points={chartValues
                            .map((value, index) => {
                              const x = (index / (chartValues.length - 1)) * 100;
                              const y = 100 - (value / 100) * 86 - 7;
                              return `${x},${y}`;
                            })
                            .join(" ")}
                        />
                      </svg>
                    </div>
                    <div className="mt-2 grid grid-cols-6 text-center text-[10px] text-gray-400">
                      {hsCodeLabels.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/60 px-4 py-2.5">
                  <div>
                    <h4 className="text-[15px] font-medium text-black">Clearance Activity</h4>
                    <p className="text-[10px] text-gray-500">Live declaration volume and HMRC response velocity</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-600">Last 30 days</span>
                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-medium text-gray-500">7 days</span>
                  </div>
                </div>
                <div className="px-4 pb-4 pt-5">
                  <div className="relative h-[136px] overflow-hidden rounded-lg border border-gray-100 bg-gray-50/40 px-3 pb-3 pt-4">
                    <div className="absolute inset-x-0 top-[26%] border-t border-gray-200/70" />
                    <div className="absolute inset-x-0 top-[54%] border-t border-gray-200/70" />
                    <div className="absolute inset-x-0 top-[82%] border-t border-gray-200/70" />
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                      <polyline
                        fill="none"
                        stroke="#111827"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={timelineValues
                          .map((value, index) => {
                            const x = (index / (timelineValues.length - 1)) * 100;
                            const y = 100 - (Math.max(18, value) / 100) * 82 - 8;
                            return `${x},${y}`;
                          })
                          .join(" ")}
                      />
                    </svg>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
                    <span>Apr 6</span>
                    <span>Apr 18</span>
                    <span>May 2</span>
                    <span>May 16</span>
                    <span>Jun 1</span>
                    <span>Jun 17</span>
                    <span>Jun 30</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
