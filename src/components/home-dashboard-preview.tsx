import {
  Bell,
  Compass,
  FileText,
  LayoutDashboard,
  Search,
  Settings,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";

const kpis = [
  {
    label: "Total Duty (30d)",
    value: "£8,420",
    detail: "Duty assigned across active declarations",
    tone: "neutral",
  },
  {
    label: "Import Value",
    value: "£312k",
    detail: "Total customs value of goods",
    tone: "success",
  },
  {
    label: "Declarations",
    value: "184",
    detail: "Total declarations filed",
    tone: "warning",
  },
  {
    label: "Avg. Duty",
    value: "£45.70",
    detail: "Average duty per declaration",
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
    status: "Submitted",
    statusTone: "info",
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
const hsCodeLabels = ["84", "39", "61", "94", "22", "73"];

function StatusPill({ tone, label }: { tone: string; label: string }) {
  if (tone === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
        <ShieldCheck className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (tone === "danger") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
        <ShieldAlert className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (tone === "info") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
        <AlertCircle className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
      <FileText className="h-3 w-3" />
      {label}
    </span>
  );
}

export function HomeDashboardPreview() {
  return (
    <div
      className="relative mx-auto mt-10 w-full max-w-[980px]"
      style={{ containerType: "inline-size" }}
    >
      <div className="absolute inset-x-12 -top-20 -z-10 h-24 rounded-full bg-blue-200/20 blur-3xl pointer-events-none" />
      <div
        className="w-[980px] max-h-[660px] overflow-hidden rounded-[22px] border border-[#dbe4f0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]"
        style={{ zoom: "min(1, calc(100cqw / 980px))" }}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          <div className="ml-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-500">
            freightcode.co.uk/dashboard
          </div>
        </div>

        <div className="grid min-h-[540px] grid-cols-[180px_minmax(0,1fr)]">
          <aside className="flex flex-col border-r border-slate-200 bg-slate-50 h-full">
            <div className="flex h-12 shrink-0 items-center border-b border-slate-200 px-4">
              <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                <span className="text-[16px] font-bold tracking-tight">freight</span>
                <span className="text-[16px] font-bold tracking-tight text-slate-500">code</span>
                <span className="ml-[-1px] -translate-y-[4px] text-[11px] font-normal text-slate-500">®</span>
              </div>
            </div>

            <div className="flex-1 px-3 py-2.5">
              <p className="mb-2 px-2 text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400">
                Platform
              </p>
              <nav className="space-y-0.5">
                <div className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5 text-[11px] text-black">
                  <LayoutDashboard className="h-3 w-3 text-slate-700" />
                  <span>Dashboard</span>
                </div>
                <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-slate-500">
                  <FileText className="h-3 w-3 text-slate-400" />
                  <span>Documents</span>
                </div>
                <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] text-slate-500">
                  <Compass className="h-3 w-3 text-slate-400" />
                  <span>Declarations</span>
                </div>
                <div className="rounded-md px-3 py-1.5 text-[11px] text-slate-500">
                  <div className="mb-1.5 flex items-center gap-2">
                    <ShieldCheck className="h-3 w-3 text-slate-400" />
                    <span>Compliance</span>
                  </div>
                  <div className="ml-4 space-y-1.5 border-l border-slate-200 pl-3 text-[10px]">
                    <div className="text-slate-500">Export Controls</div>
                    <div className="text-slate-500">HS Code Lookup</div>
                    <div className="text-slate-500">Import TRE</div>
                    <div className="font-medium text-black">Customs Reports</div>
                    <div className="text-slate-500">Financial Records</div>
                  </div>
                </div>
              </nav>
            </div>

            <div className="shrink-0 space-y-0.5 border-t border-slate-200 px-3 py-2">
              <div className="flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] text-slate-500">
                <Settings className="h-3 w-3 text-slate-400" />
                <span>Settings</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111827] text-[10px] font-semibold text-white">
                  JC
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-normal text-slate-700">James Carter</span>
                  <span className="text-[10px] text-slate-400">Enterprise</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="bg-white">
            <div className="flex h-12 items-center justify-between border-b border-slate-200 px-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-4 w-px bg-slate-200" />
                <div className="truncate text-[13px] font-semibold text-black">Customs Dashboard</div>
                <span className="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-wide text-blue-600">
                  Sandbox
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
                  <Search className="h-3 w-3" />
                  <span>Global Search</span>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  HMRC
                </div>
                <button className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white">
                  <Bell className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="space-y-4 p-4.5">
              <div className="grid gap-4 grid-cols-4">
                {kpis.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
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
                                : "bg-slate-300"
                        }`}
                      />
                    </div>
                    <div className="text-[22px] font-medium tracking-tight text-[#020817]">{item.value}</div>
                    <p className="mt-1 text-[10px] text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
                    <div>
                      <h4 className="text-[15px] font-medium text-black">Recent Declarations</h4>
                      <p className="text-[10px] text-slate-500">Tracked across linked HMRC activity</p>
                    </div>
                    <div className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                      24h
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-slate-100">
                        <tr className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          <th className="px-4 py-2.5">MRN / LRN</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Updated</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {declarationRows.map((row) => (
                        <tr key={row.mrn} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3.5 text-[11px] font-semibold text-slate-900">{row.mrn}</td>
                            <td className="px-4 py-3.5 text-[11px] text-slate-500">{row.type}</td>
                            <td className="px-4 py-3.5 text-[11px] text-slate-500">{row.updated}</td>
                            <td className="px-4 py-3.5">
                              <StatusPill tone={row.statusTone} label={row.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
                    <h4 className="text-[13px] font-medium text-black">Duty by HS Code</h4>
                    <span className="text-[10px] text-slate-400">Last 30d</span>
                  </div>
                  <div className="p-4">
                    <svg viewBox="0 0 300 120" preserveAspectRatio="none" className="h-[120px] w-full">
                      <defs>
                        <linearGradient id="dutyGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#111827" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#111827" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* horizontal grid lines */}
                      <line x1="0" y1="30" x2="300" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="0" y1="60" x2="300" y2="60" stroke="#f1f5f9" strokeWidth="1" />
                      <line x1="0" y1="90" x2="300" y2="90" stroke="#f1f5f9" strokeWidth="1" />
                      {/* fill area */}
                      <path
                        d="M0,76 C25,68 50,28 75,44 C100,60 125,12 150,20 C175,28 200,52 225,36 C250,20 275,48 300,32 L300,120 L0,120 Z"
                        fill="url(#dutyGrad)"
                      />
                      {/* line */}
                      <path
                        d="M0,76 C25,68 50,28 75,44 C100,60 125,12 150,20 C175,28 200,52 225,36 C250,20 275,48 300,32"
                        fill="none"
                        stroke="#111827"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* data points */}
                      {[
                        [0,76],[75,44],[150,20],[225,36],[300,32]
                      ].map(([x,y], i) => (
                        <circle key={i} cx={x} cy={y} r="3" fill="#111827" />
                      ))}
                    </svg>
                    <div className="mt-2 grid grid-cols-6 text-center text-[10px] text-slate-400">
                      {hsCodeLabels.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
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
