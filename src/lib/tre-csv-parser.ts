import type { TreParsePreview, TreParseWarning, TreParsedRow, TreReportFormat } from "./tre-csv-types";

export const TRE_IMPORT_MAX_ROWS = 1000;
export const TRE_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

type TreFieldKey = keyof Omit<TreParsedRow, "sourceRowHash" | "sourceLineNumber" | "reportKind">;

const HEADER_ALIASES: Record<string, TreFieldKey> = {
  "entry number": "entryIdentifierMrn",
  "entry identifier": "entryIdentifierMrn",
  "entry no": "entryIdentifierMrn",
  "entry no.": "entryIdentifierMrn",
  "entry number/mrn": "entryIdentifierMrn",
  mrn: "entryIdentifierMrn",
  "item number": "itemNumber",
  "item no": "itemNumber",
  "item no.": "itemNumber",
  declarant: "declarantEori",
  "declarant eori": "declarantEori",
  agent: "declarantEori",
  "agent eori": "declarantEori",
  "paying agent eori": "declarantEori",
  "importer eori": "importerEori",
  "commodity code": "commodityCode",
  "tariff code": "commodityCode",
  "country of origin": "countryOfOriginCode",
  origin: "countryOfOriginCode",
  "country of origin code": "countryOfOriginCode",
  "country of dispatch": "countryOfDispatchCode",
  "dispatch country": "countryOfDispatchCode",
  "destination country": "destinationCountryCode",
  "country of destination": "destinationCountryCode",
  "preference code": "preferenceCode",
  preference: "preferenceCode",
  "preference indicator": "preferenceCode",
  "item customs value": "itemCustomsValue",
  "customs value": "itemCustomsValue",
  "customs value (gbp)": "itemCustomsValue",
  "tax linetotal amount": "taxLineTotalAmount",
  "tax line total amount": "taxLineTotalAmount",
  "tax amount": "taxLineTotalAmount",
  "duty paid": "taxLineTotalAmount",
  "tax type": "taxType",
  "tax type code": "taxType",
  "duty rate (%)": "dutyRatePercent",
  "duty rate": "dutyRatePercent",
  "method of payment code": "methodOfPaymentCode",
  mop: "methodOfPaymentCode",
  "customs procedure code": "customsProcedureCodeCpc",
  cpc: "customsProcedureCodeCpc",
  "acceptance date": "acceptanceDate",
  "goods description": "goodsDescription",
  description: "goodsDescription",
  "item description": "goodsDescription",
  "net mass": "netMassKg",
  "net weight": "netMassKg",
  "document code": "documentCodes",
  "document codes": "documentCodes",
  "document reference": "documentCodes",
  "invoice total gbp": "invoiceTotalGbp",
  "invoice total": "invoiceTotalGbp",
  "total invoice converted": "invoiceTotalGbp",
  "transport costs": "transportCostGbp",
  "transport cost": "transportCostGbp",
  "total duty": "totalDutyGbp",
  "header uk duty": "totalDutyGbp",
  "total vat": "totalVatGbp",
  "total vat paid": "totalVatGbp",
  "goods departure date": "goodsDepartureDate",
  "statistical value": "itemCustomsValue",
};

const NUMERIC_FIELDS = new Set([
  "itemCustomsValue",
  "taxLineTotalAmount",
  "dutyRatePercent",
  "netMassKg",
  "invoiceTotalGbp",
  "transportCostGbp",
  "totalDutyGbp",
  "totalVatGbp",
] as const);

type NumericTreFieldKey = (typeof NUMERIC_FIELDS extends Set<infer K> ? K : never) & TreFieldKey;

function isNumericField(key: TreFieldKey): key is NumericTreFieldKey {
  return NUMERIC_FIELDS.has(key as NumericTreFieldKey);
}

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/"/g, "")
    .replace(/\s+/g, " ");
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[£,%\s"]/g, "").trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hashRow(parts: string[]): string {
  let hash = 5381;
  const input = parts.join("|");
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function buildTreRowHash(
  row: Omit<TreParsedRow, "sourceRowHash" | "sourceLineNumber">,
): string {
  return hashRow([
    row.reportKind,
    row.entryIdentifierMrn,
    row.itemNumber ?? "",
    row.declarantEori ?? "",
    row.importerEori ?? "",
    row.commodityCode ?? "",
    row.countryOfOriginCode ?? "",
    row.countryOfDispatchCode ?? "",
    row.destinationCountryCode ?? "",
    row.preferenceCode ?? "",
    String(row.itemCustomsValue ?? ""),
    row.taxType ?? "",
    String(row.taxLineTotalAmount ?? ""),
    row.methodOfPaymentCode ?? "",
    row.customsProcedureCodeCpc ?? "",
    String(row.dutyRatePercent ?? ""),
    String(row.invoiceTotalGbp ?? ""),
    String(row.transportCostGbp ?? ""),
    String(row.totalDutyGbp ?? ""),
    String(row.totalVatGbp ?? ""),
    row.acceptanceDate ?? "",
    row.goodsDescription ?? "",
    String(row.netMassKg ?? ""),
    row.documentCodes ?? "",
    row.goodsDepartureDate ?? "",
  ]);
}

/** RFC 4180-style CSV row parser (handles quoted commas and doubled quotes). */
export function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length > 1 || row[0] !== "" || field !== "") {
      pushField();
      rows.push(row);
    }
    row = [];
    field = "";
  };

  const content = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      pushField();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    if (char === "\r") {
      if (next === "\n") i++;
      pushRow();
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function hasHeader(headers: string[], candidates: string[]): boolean {
  return headers.some((h) => candidates.includes(h));
}

export function detectTreFormat(headers: string[]): TreReportFormat {
  const hasMrn = hasHeader(headers, [
    "entry number",
    "entry identifier",
    "entry no",
    "entry no.",
    "entry number/mrn",
    "mrn",
  ]);
  if (!hasMrn) return "unknown";

  const hasCommodity = hasHeader(headers, ["commodity code", "tariff code"]);
  const hasTaxType = hasHeader(headers, ["tax type", "tax type code"]);
  const hasGoodsDeparture = hasHeader(headers, ["goods departure date"]);
  const hasInvoiceTotal = hasHeader(headers, [
    "invoice total gbp",
    "invoice total",
    "total invoice converted",
  ]);
  const hasTotalDuty = hasHeader(headers, ["total duty", "header uk duty"]);
  const hasOrigin = hasHeader(headers, [
    "country of origin",
    "country of origin code",
    "origin",
  ]);

  if (hasCommodity && hasGoodsDeparture) return "export_item";
  if (hasCommodity && (hasOrigin || hasHeader(headers, ["preference code", "preference"]))) {
    return "import_item";
  }
  if (hasCommodity) return "import_item";
  if (hasTaxType && !hasCommodity) return "import_tax_lines";
  if ((hasInvoiceTotal || hasTotalDuty) && !hasCommodity) return "import_header";

  return "unknown";
}

function mapRecord(
  format: TreReportFormat,
  headers: string[],
  values: string[],
  lineNumber: number,
  warnings: TreParseWarning[],
): TreParsedRow | null {
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    record[header] = (values[idx] ?? "").trim();
  });

  const mapped: Partial<TreParsedRow> = {
    sourceLineNumber: lineNumber,
    reportKind: format,
  };

  const docCodes: string[] = [];
  for (const [header, value] of Object.entries(record)) {
    const normalized = normalizeHeader(header);
    if (normalized.startsWith("document code") || normalized.startsWith("document reference")) {
      if (value) docCodes.push(value);
      continue;
    }
    const key = HEADER_ALIASES[normalized];
    if (!key) continue;
    if (isNumericField(key)) {
      mapped[key] = parseNumber(value);
    } else {
      mapped[key] = value || undefined;
    }
  }

  if (docCodes.length > 0) {
    mapped.documentCodes = [...new Set(docCodes)].join(", ");
  }

  const mrn = mapped.entryIdentifierMrn?.trim();
  if (!mrn) {
    warnings.push({ line: lineNumber, message: "Skipped row without entry number / MRN." });
    return null;
  }

  mapped.entryIdentifierMrn = mrn;
  if (mapped.commodityCode) {
    mapped.commodityCode = mapped.commodityCode.replace(/\D/g, "").slice(0, 10);
  }
  for (const key of ["countryOfOriginCode", "countryOfDispatchCode", "destinationCountryCode"] as const) {
    if (mapped[key]) mapped[key] = mapped[key]!.toUpperCase().slice(0, 2);
  }

  const row = mapped as Omit<TreParsedRow, "sourceRowHash">;
  return {
    ...row,
    sourceRowHash: buildTreRowHash(row),
    sourceLineNumber: lineNumber,
  };
}

export function checksumCsv(text: string): string {
  return hashRow([text.length.toString(), text.slice(0, 512), text.slice(-512)]);
}

function parseAllRows(text: string, format: TreReportFormat, maxRows: number) {
  const records = parseCsvRecords(text);
  const warnings: TreParseWarning[] = [];
  const headers = records[0]?.map(normalizeHeader) ?? [];
  const parsedRows: TreParsedRow[] = [];
  let skippedEmptyRows = 0;

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.every((cell) => !cell.trim())) {
      skippedEmptyRows++;
      continue;
    }
    const row = mapRecord(format, headers, values, i + 1, warnings);
    if (row) parsedRows.push(row);
  }

  const truncated = parsedRows.length > maxRows;
  const storedRows = parsedRows.slice(0, maxRows);

  if (truncated) {
    warnings.push({
      line: 0,
      message: `Only the first ${maxRows} rows will be stored (Convex limit). Split larger exports or contact support.`,
    });
  }

  return { records, headers, warnings, parsedRows, storedRows, skippedEmptyRows, truncated };
}

export function parseTreCsv(text: string, maxRows = TRE_IMPORT_MAX_ROWS): TreParsePreview {
  const records = parseCsvRecords(text);

  if (records.length < 2) {
    return {
      format: "unknown",
      headers: [],
      rowCount: 0,
      storedRowCount: 0,
      skippedEmptyRows: 0,
      dateRange: {},
      eoris: [],
      sampleRows: [],
      warnings: [{ line: 0, message: "File has no data rows." }],
      checksum: checksumCsv(text),
      truncated: false,
      maxRows,
    };
  }

  const headers = records[0].map(normalizeHeader);
  const format = detectTreFormat(headers);
  const warnings: TreParseWarning[] = [];

  if (format === "unknown") {
    warnings.push({
      line: 1,
      message:
        "Unrecognised CSV format. Expected an HMRC TRE report (Import Item, Import Header, Import Tax Lines, or Export Item).",
    });
    return {
      format,
      headers: records[0].map((h) => h.trim()),
      rowCount: 0,
      storedRowCount: 0,
      skippedEmptyRows: 0,
      dateRange: {},
      eoris: [],
      sampleRows: [],
      warnings,
      checksum: checksumCsv(text),
      truncated: false,
      maxRows,
    };
  }

  const parsed = parseAllRows(text, format, maxRows);
  warnings.push(...parsed.warnings);

  const eoriSet = new Set<string>();
  const dates: string[] = [];
  for (const row of parsed.storedRows) {
    if (row.declarantEori) eoriSet.add(row.declarantEori.toUpperCase());
    if (row.importerEori) eoriSet.add(row.importerEori.toUpperCase());
    if (row.acceptanceDate) dates.push(row.acceptanceDate);
    if (row.goodsDepartureDate) dates.push(row.goodsDepartureDate);
  }
  dates.sort();

  return {
    format,
    headers: records[0].map((h) => h.trim()),
    rowCount: parsed.parsedRows.length,
    storedRowCount: parsed.storedRows.length,
    skippedEmptyRows: parsed.skippedEmptyRows,
    dateRange: {
      earliest: dates[0],
      latest: dates[dates.length - 1],
    },
    eoris: [...eoriSet].sort(),
    sampleRows: parsed.storedRows.slice(0, 5),
    warnings,
    checksum: checksumCsv(text),
    truncated: parsed.truncated,
    maxRows,
  };
}

export function parseTreCsvRows(text: string, maxRows = TRE_IMPORT_MAX_ROWS): TreParsedRow[] {
  const preview = parseTreCsv(text, maxRows);
  if (preview.format === "unknown" || preview.rowCount === 0) return [];
  const parsed = parseAllRows(text, preview.format, maxRows);
  return parsed.storedRows;
}
