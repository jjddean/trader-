export type TreReportFormat =
  | "import_item"
  | "import_header"
  | "import_tax_lines"
  | "export_item"
  | "unknown";

export interface TreParsedRow {
  reportKind: TreReportFormat;
  entryIdentifierMrn: string;
  itemNumber?: string;
  declarantEori?: string;
  importerEori?: string;
  commodityCode?: string;
  countryOfOriginCode?: string;
  countryOfDispatchCode?: string;
  destinationCountryCode?: string;
  preferenceCode?: string;
  itemCustomsValue?: number;
  taxLineTotalAmount?: number;
  methodOfPaymentCode?: string;
  customsProcedureCodeCpc?: string;
  taxType?: string;
  dutyRatePercent?: number;
  acceptanceDate?: string;
  goodsDescription?: string;
  netMassKg?: number;
  documentCodes?: string;
  invoiceTotalGbp?: number;
  transportCostGbp?: number;
  totalDutyGbp?: number;
  totalVatGbp?: number;
  goodsDepartureDate?: string;
  sourceRowHash: string;
  sourceLineNumber: number;
}

export interface TreParseWarning {
  line: number;
  message: string;
}

export interface TreParsePreview {
  format: TreReportFormat;
  headers: string[];
  rowCount: number;
  storedRowCount: number;
  skippedEmptyRows: number;
  dateRange: { earliest?: string; latest?: string };
  eoris: string[];
  sampleRows: TreParsedRow[];
  warnings: TreParseWarning[];
  checksum: string;
  truncated: boolean;
  maxRows: number;
}

export interface TreImportResult {
  importId: string;
  lineItemsStored: number;
  lineItemsSkipped: number;
  rowCount: number;
  warnings: string[];
}

export const TRE_FORMAT_LABELS: Record<TreReportFormat, string> = {
  import_item: "Import Item",
  import_header: "Import Header",
  import_tax_lines: "Import Tax Lines",
  export_item: "Export Item",
  unknown: "Unknown",
};
