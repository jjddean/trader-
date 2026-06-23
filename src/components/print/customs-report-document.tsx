import { PrintDocumentHeader, PrintField } from "@/components/print/print-document-shell";
import type { CustomsReportPrintData } from "@/lib/print-sheet";

export function CustomsReportPrintContent({ report }: { report: CustomsReportPrintData }) {
  const items = report.items || [];

  return (
    <>
      <PrintDocumentHeader
        title={report.mrn || "Customs Report"}
        subtitle={[report.date, report.broker, report.status ? `${report.status} (${report.score ?? 0}%)` : null]
          .filter(Boolean)
          .join(" · ")}
      />
      <section className="mb-8 space-y-6">
        <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">
          Declaration Summary
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PrintField label="DUCR" value={report.ducr} />
          <PrintField label="LRN" value={report.lrn} />
          <PrintField label="Importer" value={report.importer} />
          <PrintField label="Declarant" value={report.declarant} />
          <PrintField label="Acceptance Date" value={report.acceptanceDate} />
          <PrintField label="Clearance Date" value={report.clearanceDate} />
          <PrintField
            label="Routing"
            value={`${report.originCountry || "N/A"} → ${report.dispatchCountry || "N/A"} → ${report.portCode || "N/A"}`}
          />
          <PrintField label="Total Invoice Value" value={report.totalInvoiceValue} />
          <PrintField label="Total Duty & VAT" value={report.totalDutyAndVat} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-900">Line Items</h2>
        {items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">#</th>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Classification</th>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Values</th>
                  <th className="px-4 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-wider text-slate-500">Taxes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((item) => (
                  <tr key={String(item.sequence)} className="align-top">
                    <td className="px-4 py-4 text-xs font-medium text-slate-400">{item.sequence}</td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-mono font-medium text-slate-900">{item.commodityCode}</p>
                      <p className="mt-1 text-[0.6875rem] text-slate-600">{item.description}</p>
                      <p className="mt-2 text-[0.625rem] text-slate-400">Net: {item.netMass}</p>
                      <p className="text-[0.625rem] text-slate-400">CPC: {item.cpc}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[0.6875rem] text-slate-600">Inv: {item.itemPrice}</p>
                      <p className="text-[0.6875rem] font-medium text-slate-900">Customs: {item.customsValue}</p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="text-[0.6875rem] text-red-600">Duty: {item.dutyPaid}</p>
                      <p className="text-[0.6875rem] text-red-600">VAT: {item.vatAmount}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No goods items available.</p>
        )}
      </section>
    </>
  );
}
