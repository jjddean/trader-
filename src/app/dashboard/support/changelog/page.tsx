
export default function ChangelogPage() {
  const updates = [
    {
      version: "v0.1.4",
      date: "March 22, 2026",
      title: "Trader Dress Rehearsal (TDR) Readiness",
      type: "hmrc",
      changes: [
        "Added proactive HMRC 3 req/s rate-limiting with token bucket algorithm",
        "XML interpolation now strictly escaped to prevent malformed payload rejections",
        "Added dynamic WCO TypeCode mapping for imports (A-Z) and exports",
        "Added fully supported declaration Amend (Code 13) and Cancel (INV) routes",
        "Implemented HMRC 2-step pull notifications fallback flow",
      ],
    },
    {
      version: "v0.1.3",
      date: "March 18, 2026",
      title: "CDS Payload Validation",
      type: "feature",
      changes: [
        "Resolved sequence and formatting errors in WCO XML generation",
        "Implemented specific EDIFACT codes for measurement units in goods items",
        "Corrected Address structure for Declarant, Exporter, and Importer elements",
        "Achieved first successful DMSACC (Declaration Accepted) status in Sandbox",
      ],
    },
    {
      version: "v0.1.2",
      date: "March 17, 2026",
      title: "HMRC OAuth 2.0 Integration",
      type: "security",
      changes: [
        "Added HMRC 'Connect' flow with government gateway redirect",
        "Secure token storage in Convex with user-level encryption",
        "Automatic background refresh of HMRC OAuth tokens before 4-hour expiry",
      ],
    },
    {
      version: "v0.1.1",
      date: "March 12, 2026",
      title: "Document Uploads and UI Polish",
      type: "feature",
      changes: [
        "New Smart Upload documents page with Cloudflare R2 integration",
        "Aligned Reports side-sheet UI with standard application design language",
        "Real-time visual updates for uploaded file statuses",
      ],
    },
  ];

  return (
    <div className="mx-auto flex h-full max-w-[800px] flex-col px-8 py-12">
      <div className="mb-8 border-b border-[#e9e9e7] pb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[#37352f] mb-2">Changelog</h1>
        <p className="text-xs text-[#787774]">
          Latest updates, fixes, and HMRC integrations in FreightCode.
        </p>
      </div>

      <div className="flex flex-col gap-10">
        {updates.map((update, idx) => (
          <div key={idx} className="relative pl-8 border-l border-[#e9e9e7]">
            {/* Timeline Dot */}
            <div className="absolute left-[-5px] top-[6px] h-[9px] w-[9px] rounded-full bg-[#111827] ring-4 ring-white" />
            
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-[#37352f] bg-gray-100 px-2 py-0.5 rounded-[4px]">
                {update.version}
              </span>
              <span className="text-xs text-[#787774]">{update.date}</span>
            </div>
            
            <h2 className="text-base font-semibold text-[#37352f] mb-4">{update.title}</h2>
            
            <ul className="space-y-3">
              {update.changes.map((change, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[#37352f] leading-relaxed">
                  <div className="mt-1 flex-shrink-0 text-[#787774]">•</div>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
