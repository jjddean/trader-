export interface TreParsedRow {
  entryIdentifierMrn: string;
  itemNumber?: string;
  declarantEori?: string;
  importerEori?: string;
  commodityCode?: string;
  countryOfOriginCode?: string;
  preferenceCode?: string;
  itemCustomsValue?: number;
  taxLineTotalAmount?: number;
  methodOfPaymentCode?: string;
  customsProcedureCodeCpc?: string;
  taxType?: string;
  acceptanceDate?: string;
  sourceRowHash: string;
  sourceLineNumber: number;
}

export interface TreParseWarning {
  line: number;
  message: string;
}

export interface TreParsePreview {
  format: "item_report" | "unknown";
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
