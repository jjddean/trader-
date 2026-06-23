import type { TreParsePreview, TreParseWarning, TreParsedRow } from "./tre-csv-types";

export const TRE_IMPORT_MAX_ROWS = 1000;
export const TRE_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

const HEADER_ALIASES: Record<string, keyof Omit<TreParsedRow, "sourceRowHash" | "sourceLineNumber">> = {
  "entry number": "entryIdentifierMrn",
  "entry identifier": "entryIdentifierMrn",
  "entry no": "entryIdentifierMrn",
  "entry no.": "entryIdentifierMrn",
  "mrn": "entryIdentifierMrn",
  "item number": "itemNumber",
  "item no": "itemNumber",
  "item no.": "itemNumber",
  "declarant eori": "declarantEori",
  "agent eori": "declarantEori",
  "importer eori": "importerEori",
  "commodity code": "commodityCode",
  "tariff code": "commodityCode",
  "country of origin": "countryOfOriginCode",
  "origin": "countryOfOriginCode",
  "country of origin code": "countryOfOriginCode",
  "preference code": "preferenceCode",
  "preference": "preferenceCode",
  "item customs value": "itemCustomsValue",
  "customs value": "itemCustomsValue",
  "tax linetotal amount": "taxLineTotalAmount",
  "tax line total amount": "taxLineTotalAmount",
  "tax amount": "taxLineTotalAmount",
  "duty paid": "taxLineTotalAmount",
  "tax type": "taxType",
  "tax type code": "taxType",
  "method of payment code": "methodOfPaymentCode",
  "mop": "methodOfPaymentCode",
  "customs procedure code": "customsProcedureCodeCpc",
  "cpc": "customsProcedureCodeCpc",
  "acceptance date": "acceptanceDate",
};

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
  const cleaned = value.replace(/[£,\s"]/g, "").trim();
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

export function buildTreRowHash(row: Omit<TreParsedRow, "sourceRowHash" | "sourceLineNumber">): string {
  return hashRow([
    row.entryIdentifierMrn,
    row.itemNumber ?? "",
    row.commodityCode ?? "",
    row.taxType ?? "",
    String(row.taxLineTotalAmount ?? ""),
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

function detectFormat(headers: string[]): "item_report" | "unknown" {
  const hasMrn = headers.some((h) =>
    ["entry number", "entry identifier", "entry no", "entry no.", "mrn"].includes(h),
  );
  const hasCommodity = headers.some((h) => ["commodity code", "tariff code"].includes(h));
  return hasMrn && hasCommodity ? "item_report" : "unknown";
}

function mapRecord(
  headers: string[],
  values: string[],
  lineNumber: number,
  warnings: TreParseWarning[],
): TreParsedRow | null {
  const record: Record<string, string> = {};
  headers.forEach((header, idx) => {
    record[header] = (values[idx] ?? "").trim();
  });

  const mapped: Partial<TreParsedRow> = { sourceLineNumber: lineNumber };
  for (const [header, value] of Object.entries(record)) {
    const key = HEADER_ALIASES[header];
    if (!key) continue;
    if (key === "itemCustomsValue" || key === "taxLineTotalAmount") {
      mapped[key] = parseNumber(value);
    } else {
      mapped[key] = value || undefined;
    }
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
  if (mapped.countryOfOriginCode) {
    mapped.countryOfOriginCode = mapped.countryOfOriginCode.toUpperCase().slice(0, 2);
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

export function parseTreCsv(text: string, maxRows = TRE_IMPORT_MAX_ROWS): TreParsePreview {
  const records = parseCsvRecords(text);
  const warnings: TreParseWarning[] = [];

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
  const format = detectFormat(headers);

  if (format === "unknown") {
    warnings.push({
      line: 1,
      message:
        "Unrecognised CSV format. Expected an HMRC Import Item Report with Entry Number and Commodity Code columns.",
    });
  }

  const parsedRows: TreParsedRow[] = [];
  let skippedEmptyRows = 0;

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.every((cell) => !cell.trim())) {
      skippedEmptyRows++;
      continue;
    }
    const row = mapRecord(headers, values, i + 1, warnings);
    if (row) parsedRows.push(row);
  }

  const truncated = parsedRows.length > maxRows;
  const storedRows = parsedRows.slice(0, maxRows);

  const eoriSet = new Set<string>();
  const dates: string[] = [];
  for (const row of storedRows) {
    if (row.declarantEori) eoriSet.add(row.declarantEori.toUpperCase());
    if (row.importerEori) eoriSet.add(row.importerEori.toUpperCase());
    if (row.acceptanceDate) dates.push(row.acceptanceDate);
  }

  if (truncated) {
    warnings.push({
      line: 0,
      message: `Only the first ${maxRows} rows will be stored (Convex limit). Split larger exports or contact support.`,
    });
  }

  dates.sort();

  return {
    format,
    headers: records[0].map((h) => h.trim()),
    rowCount: parsedRows.length,
    storedRowCount: storedRows.length,
    skippedEmptyRows,
    dateRange: {
      earliest: dates[0],
      latest: dates[dates.length - 1],
    },
    eoris: [...eoriSet].sort(),
    sampleRows: storedRows.slice(0, 5),
    warnings,
    checksum: checksumCsv(text),
    truncated,
    maxRows,
  };
}

export function previewToStorableRows(preview: TreParsePreview, allRows: TreParsedRow[]): TreParsedRow[] {
  return allRows.slice(0, preview.maxRows);
}

export function parseTreCsvRows(text: string, maxRows = TRE_IMPORT_MAX_ROWS): TreParsedRow[] {
  const preview = parseTreCsv(text, maxRows);
  if (preview.format === "unknown" || preview.rowCount === 0) return [];

  const records = parseCsvRecords(text);
  const headers = records[0].map(normalizeHeader);
  const warnings: TreParseWarning[] = [];
  const parsedRows: TreParsedRow[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.every((cell) => !cell.trim())) continue;
    const row = mapRecord(headers, values, i + 1, warnings);
    if (row) parsedRows.push(row);
  }

  return parsedRows.slice(0, maxRows);
}
