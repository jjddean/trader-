import Groq from "groq-sdk";
import { extractUnitFacts, normaliseUnitValue } from "./units";
import { sanitizeDocumentText } from "./sanitize";

export const EXPORT_EXTRACTION_PROMPT_VERSION = "export-facts-v1";

export interface ExportProductSpec {
  key: string;
  valueRaw: string;
  valueNum: number | null;
  unit: string | null;
  sourcePage: number | null;
  sourceQuote: string;
  confidence: number;
}

export interface ExportProduct {
  lineItemRef: string | null;
  productName: string;
  manufacturer: string | null;
  modelNo: string | null;
  partNo: string | null;
  quantity: number | null;
  unitValueGbp: number | null;
  technicalDescription: string;
  specs: ExportProductSpec[];
}

export interface ExportExtractionResult {
  documentSummary: {
    invoiceNumber: string | null;
    supplier: string | null;
    customer: string | null;
    currency: string | null;
  };
  shipment: {
    originCountry: string | null;
    destinationCountry: string | null;
    consignee: { name: string | null; address: string | null; country: string | null };
    endUser: { name: string | null; address: string | null; country: string | null };
    intendedUse: string | null;
  };
  products: ExportProduct[];
  extractionWarnings: string[];
  missingFields: string[];
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseParty(value: unknown) {
  if (!value || typeof value !== "object") {
    return { name: null, address: null, country: null };
  }
  const p = value as Record<string, unknown>;
  return {
    name: asString(p.name),
    address: asString(p.address),
    country: asString(p.country),
  };
}

function parseSpec(value: unknown): ExportProductSpec | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const key = asString(s.key);
  const valueRaw = asString(s.value_raw ?? s.valueRaw);
  if (!key || !valueRaw) return null;

  const unit = asString(s.unit);
  let valueNum = asNumber(s.value_num ?? s.valueNum);
  if (valueNum == null && unit) {
    const fromRaw = extractUnitFacts(valueRaw)[0];
    if (fromRaw?.valueNum != null) {
      valueNum = normaliseUnitValue(fromRaw.valueNum, fromRaw.unit ?? unit, fromRaw.key);
    }
  }

  return {
    key,
    valueRaw,
    valueNum,
    unit,
    sourcePage: asNumber(s.source_page ?? s.sourcePage),
    sourceQuote: asString(s.source_quote ?? s.sourceQuote) ?? valueRaw,
    confidence: asNumber(s.confidence) ?? 0.7,
  };
}

function parseProduct(value: unknown): ExportProduct | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const productName = asString(p.product_name ?? p.productName);
  if (!productName) return null;

  const specsRaw = Array.isArray(p.specs) ? p.specs : [];
  const specs = specsRaw.map(parseSpec).filter(Boolean) as ExportProductSpec[];

  return {
    lineItemRef: asString(p.line_item_ref ?? p.lineItemRef),
    productName,
    manufacturer: asString(p.manufacturer),
    modelNo: asString(p.model_no ?? p.modelNo),
    partNo: asString(p.part_no ?? p.partNo),
    quantity: asNumber(p.quantity),
    unitValueGbp: asNumber(p.unit_value_gbp ?? p.unitValueGbp),
    technicalDescription: asString(p.technical_description ?? p.technicalDescription) ?? productName,
    specs,
  };
}

export function validateExportExtraction(raw: unknown): ExportExtractionResult {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const doc = (root.document_summary ?? root.documentSummary ?? {}) as Record<string, unknown>;
  const ship = (root.shipment ?? {}) as Record<string, unknown>;
  const productsRaw = Array.isArray(root.products) ? root.products : [];

  const products = productsRaw.map(parseProduct).filter(Boolean) as ExportProduct[];
  const warningsRaw = root.extraction_warnings ?? root.extractionWarnings;
  const extractionWarnings = Array.isArray(warningsRaw) ? warningsRaw.map(String) : [];
  const missingRaw = root.missing_fields ?? root.missingFields;
  const missingFields = Array.isArray(missingRaw) ? missingRaw.map(String) : [];

  if (products.length === 0) {
    extractionWarnings.push("No products could be parsed from model output");
  }

  return {
    documentSummary: {
      invoiceNumber: asString(doc.invoice_number ?? doc.invoiceNumber),
      supplier: asString(doc.supplier),
      customer: asString(doc.customer),
      currency: asString(doc.currency),
    },
    shipment: {
      originCountry: asString(ship.origin_country ?? ship.originCountry),
      destinationCountry: asString(ship.destination_country ?? ship.destinationCountry),
      consignee: parseParty(ship.consignee),
      endUser: parseParty(ship.end_user ?? ship.endUser),
      intendedUse: asString(ship.intended_use ?? ship.intendedUse),
    },
    products,
    extractionWarnings,
    missingFields,
  };
}

export const EXPORT_FACTS_SYSTEM_PROMPT = `You extract shipment and technical facts for UK export-control review.
Do NOT classify goods against control lists. Do NOT give legal advice.
Output valid JSON only matching this schema:
{
  "document_summary": { "invoice_number": string|null, "supplier": string|null, "customer": string|null, "currency": string|null },
  "shipment": {
    "origin_country": string|null,
    "destination_country": string|null,
    "consignee": { "name": string|null, "address": string|null, "country": string|null },
    "end_user": { "name": string|null, "address": string|null, "country": string|null },
    "intended_use": string|null
  },
  "products": [{
    "line_item_ref": string|null,
    "product_name": string,
    "manufacturer": string|null,
    "model_no": string|null,
    "part_no": string|null,
    "quantity": number|null,
    "unit_value_gbp": number|null,
    "technical_description": string,
    "specs": [{ "key": string, "value_raw": string, "value_num": number|null, "unit": string|null, "source_page": integer|null, "source_quote": string, "confidence": number }]
  }],
  "extraction_warnings": [string],
  "missing_fields": [string]
}
Rules: copy values exactly when present; do not infer missing specs; attach source_quote from document text; keep units unchanged; use ISO-2 country codes when clear.`;

export async function extractExportFactsFromText(rawText: string): Promise<ExportExtractionResult> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("Groq API Key not configured");

  const sanitized = sanitizeDocumentText(rawText);
  const unitHints = extractUnitFacts(sanitized).slice(0, 40);

  const groq = new Groq({ apiKey: groqApiKey });
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: EXPORT_FACTS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Document text:\n${sanitized}\n\nDetected unit patterns (hints only):\n${JSON.stringify(unitHints)}`,
      },
    ],
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseContent);
  } catch {
    throw new Error("Failed to parse AI extraction response");
  }

  const validated = validateExportExtraction(parsed);

  for (const product of validated.products) {
    const existingKeys = new Set(product.specs.map((s) => s.key));
    for (const hint of unitHints) {
      if (existingKeys.has(hint.key)) continue;
      product.specs.push({
        key: hint.key,
        valueRaw: hint.valueRaw,
        valueNum: hint.valueNum != null && hint.unit ? normaliseUnitValue(hint.valueNum, hint.unit, hint.key) : hint.valueNum,
        unit: hint.unit,
        sourcePage: null,
        sourceQuote: hint.sourceQuote,
        confidence: 0.85,
      });
    }
  }

  return validated;
}
