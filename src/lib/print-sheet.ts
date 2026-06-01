export const FINANCIAL_RECORD_PRINT_KEY = "freightcode:print:financial-record";
export const CUSTOMS_REPORT_PRINT_KEY = "freightcode:print:customs-report";

export interface FinancialRecordPrintData {
  mrn?: string;
  date?: string;
  method?: string;
  accountNumber?: string;
  statementContext?: string;
  paymentLimit?: string;
  type?: string;
  calculationMethod?: string;
  natureOfTransaction?: string;
  amount?: number;
}

export interface CustomsReportPrintData {
  mrn?: string;
  date?: string;
  broker?: string;
  ducr?: string;
  lrn?: string;
  importer?: string;
  declarant?: string;
  acceptanceDate?: string;
  clearanceDate?: string;
  originCountry?: string;
  dispatchCountry?: string;
  portCode?: string;
  totalInvoiceValue?: string;
  totalDutyAndVat?: string;
  status?: string;
  score?: number;
  items?: Array<{
    sequence?: number | string;
    commodityCode?: string;
    description?: string;
    netMass?: string;
    cpc?: string;
    itemPrice?: string;
    customsValue?: string;
    dutyPaid?: string;
    vatAmount?: string;
  }>;
}

type PrintRouter = {
  push: (href: string) => void;
};

export function openFinancialRecordPrint(
  router: PrintRouter,
  record: FinancialRecordPrintData,
) {
  sessionStorage.setItem(FINANCIAL_RECORD_PRINT_KEY, JSON.stringify(record));
  router.push("/dashboard/records/print");
}

export function openCustomsReportPrint(
  router: PrintRouter,
  report: CustomsReportPrintData,
) {
  sessionStorage.setItem(CUSTOMS_REPORT_PRINT_KEY, JSON.stringify(report));
  router.push("/dashboard/reports/print");
}

export function readFinancialRecordPrintData(): FinancialRecordPrintData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(FINANCIAL_RECORD_PRINT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FinancialRecordPrintData;
  } catch {
    return null;
  }
}

export function readCustomsReportPrintData(): CustomsReportPrintData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(CUSTOMS_REPORT_PRINT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomsReportPrintData;
  } catch {
    return null;
  }
}

export function triggerBrowserPrint() {
  window.print();
}
