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

export function triggerBrowserPrint() {
  window.print();
}
