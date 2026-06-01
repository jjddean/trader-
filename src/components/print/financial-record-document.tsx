import { PrintDocumentShell, PrintField } from "@/components/print/print-document-shell";
import type { FinancialRecordPrintData } from "@/lib/print-sheet";

export function FinancialRecordDocument({ record }: { record: FinancialRecordPrintData }) {
  const amount = Number(record.amount || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <PrintDocumentShell
      backHref="/dashboard/records"
      backLabel="Back to Financial Records"
      title="Tax Line Record"
      subtitle={[record.date, record.mrn].filter(Boolean).join(" · ")}
    >
      <section className="mb-8 space-y-6">
        <h2 className="border-b border-gray-200 pb-3 text-sm font-semibold text-gray-900">
          Transaction &amp; Account Details
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PrintField label="Account Used" value={record.method} />
          <PrintField label="Account Number" value={record.accountNumber} />
          <PrintField label="Statement Context" value={record.statementContext} />
          <PrintField label="Payment Limits / Balance" value={record.paymentLimit} />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="border-b border-gray-200 pb-3 text-sm font-semibold text-gray-900">
          Tax Line Breakdown
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PrintField label="Specific Tax Type" value={record.type} />
          <PrintField label="Calculation Method" value={record.calculationMethod} />
          <PrintField label="Nature of Transaction" value={record.natureOfTransaction} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-xs font-semibold text-gray-900">Total Tax Amount</p>
            <p className="mt-0.5 text-[0.625rem] text-gray-500">Calculated value for this ledger line</p>
          </div>
          <p className="text-xl font-bold tracking-tight text-gray-900">£{amount}</p>
        </div>
      </section>
    </PrintDocumentShell>
  );
}
