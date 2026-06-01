import { PrintDocumentShell, PrintField } from "@/components/print/print-document-shell";
import type { CustomsReportPrintData } from "@/lib/print-sheet";

export function CustomsReportDocument({ report }: { report: CustomsReportPrintData }) {
  const items = report.items || [];

  return (
    <PrintDocumentShell
      backHref="/dashboard/reports"
      backLabel="Back to Customs Reports"
      title={report.mrn || "Customs Report"}
      subtitle={[report.date, report.broker, report.status ? `${report.status} (${report.score ?? 0}%)` : null]
        .filter(Boolean)
        .join(" · ")}
    >
      <section className="mb-8 space-y-6">
        <h2 className="border-b border-gray-200 pb-3 text-sm font-semibold text-gray-900">
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
        <h2 className="border-b border-gray-200 pb-3 text-sm font-semibold text-gray-900">Line Items</h2>
        {items.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">#</th>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Classification</th>
                  <th className="px-4 py-3 text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Values</th>
                  <th className="px-4 py-3 text-right text-[0.625rem] font-semibold uppercase tracking-wider text-gray-500">Taxes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {items.map((item) => (
                  <tr key={String(item.sequence)} className="align-top">
                    <td className="px-4 py-4 text-xs font-medium text-gray-400">{item.sequence}</td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-mono font-medium text-gray-900">{item.commodityCode}</p>
                      <p className="mt-1 text-[0.6875rem] text-gray-600">{item.description}</p>
                      <p className="mt-2 text-[0.625rem] text-gray-400">Net: {item.netMass}</p>
                      <p className="text-[0.625rem] text-gray-400">CPC: {item.cpc}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-[0.6875rem] text-gray-600">Inv: {item.itemPrice}</p>
                      <p className="text-[0.6875rem] font-medium text-gray-900">Customs: {item.customsValue}</p>
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
          <p className="text-sm text-gray-500">No goods items available.</p>
        )}
      </section>
    </PrintDocumentShell>
  );
}
