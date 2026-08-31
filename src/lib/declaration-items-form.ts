import { isValidH1PreferenceCode } from "@/lib/h1-preference";

export type AdditionalDocumentInput = {
  CategoryCode: string;
  TypeCode: string;
  ID: string;
  StatusCode?: string;
};

export type DocSlot = { code: string; ref: string };

export type GoodsItemFormRow = {
  key: string;
  description: string;
  commodityCode: string;
  originCountry: string;
  valueAmount: string;
  procedureCode: string;
  additionalProcedureCode: string;
  preferenceCode: string;
  grossWeightKg: string;
  netWeightKg: string;
  supplementaryUnitQty: string;
  packageCount: string;
  packageType: string;
  shippingMarks: string;
  docs: DocSlot[];
};

const CHED_TYPES = ["853", "851", "C085", "C084"];

export function looksLikeConvexId(v: string): boolean {
  return /^[a-z0-9]{20,}$/.test(v);
}

export function itemErrors(it: GoodsItemFormRow): Record<string, string> {
  const e: Record<string, string> = {};
  if (!it.commodityCode.trim()) e.commodityCode = "Commodity code is required.";
  else if (!/^\d{10}$/.test(it.commodityCode.trim())) e.commodityCode = "Ten digits.";
  if (!it.originCountry.trim()) e.originCountry = "Origin is required.";
  else if (!/^[A-Z]{2}$/.test(it.originCountry.trim())) e.originCountry = "Two-letter code.";
  if (!it.valueAmount.trim()) e.valueAmount = "Value is required.";
  else if (Number.isNaN(Number(it.valueAmount))) e.valueAmount = "Must be a number.";
  if (!it.procedureCode.trim()) e.procedureCode = "Procedure code is required.";
  if (!it.preferenceCode.trim()) e.preferenceCode = "Preference is required.";
  else if (!isValidH1PreferenceCode(it.preferenceCode)) e.preferenceCode = "Three digits.";
  if (!it.grossWeightKg.trim()) e.grossWeightKg = "Gross weight is required.";
  return e;
}

export function getNormalizedDocs(item: Record<string, unknown>): AdditionalDocumentInput[] {
  const source = Array.isArray(item.additionalDocuments)
    ? item.additionalDocuments
    : Array.isArray(item.additionalDocument)
      ? item.additionalDocument
      : [];

  return source
    .map((doc): AdditionalDocumentInput => {
      const sourceDoc = typeof doc === "object" && doc !== null ? (doc as Record<string, unknown>) : {};
      return {
        CategoryCode: String(sourceDoc.CategoryCode || sourceDoc.categoryCode || sourceDoc.category || "")
          .trim()
          .toUpperCase(),
        TypeCode: String(sourceDoc.TypeCode || sourceDoc.typeCode || sourceDoc.type || "")
          .trim()
          .toUpperCase(),
        ID: String(sourceDoc.ID || sourceDoc.id || sourceDoc.reference || "").trim(),
      };
    })
    .filter((doc) => doc.CategoryCode || doc.TypeCode || doc.ID);
}

function deriveStatusCode(category: string, type: string): string {
  if (category === "N" && CHED_TYPES.includes(type)) return "XW";
  if (category === "Y" && ["929", "930"].includes(type)) return "XB";
  return "";
}

export function slotsToValidDocs(slots: DocSlot[]): AdditionalDocumentInput[] {
  const seen = new Set<string>();
  return slots
    .map((slot) => {
      const raw = slot.code.replace(/\s+/g, "").trim().toUpperCase();
      const category = raw.slice(0, 1);
      const type = raw.slice(1);
      return {
        CategoryCode: category,
        TypeCode: type,
        ID: slot.ref.trim(),
        StatusCode: raw ? deriveStatusCode(category, type) : "",
      };
    })
    .filter((doc) => doc.CategoryCode && doc.TypeCode && doc.ID)
    .filter((doc) => !/^excluded$/i.test(doc.ID))
    .filter((doc) => {
      const key = `${doc.CategoryCode}${doc.TypeCode}`.toUpperCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parsePositiveNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = parsePositiveNumber(value);
  return parsed == null ? undefined : Math.trunc(parsed);
}

function g(raw: Record<string, unknown>, k: string): string {
  return raw[k] == null ? "" : String(raw[k]);
}

export function mapGoodsItem(raw: Record<string, unknown>, index: number): GoodsItemFormRow {
  const docs = getNormalizedDocs(raw);
  const slotCount = Math.max(2, docs.length);
  return {
    key: String(raw._id ?? `row-${index}`),
    description: g(raw, "description"),
    commodityCode: g(raw, "commodityCode"),
    originCountry: g(raw, "originCountry").toUpperCase(),
    valueAmount: g(raw, "valueAmount"),
    procedureCode: g(raw, "procedureCode"),
    additionalProcedureCode: g(raw, "additionalProcedureCode"),
    preferenceCode: g(raw, "preferenceCode"),
    grossWeightKg: g(raw, "grossWeightKg"),
    netWeightKg: g(raw, "netWeightKg"),
    supplementaryUnitQty: g(raw, "supplementaryUnitQty"),
    packageCount: g(raw, "packageCount"),
    packageType: g(raw, "packageType"),
    shippingMarks: g(raw, "shippingMarks"),
    docs: Array.from({ length: slotCount }, (_, i) => ({
      code: docs[i] ? `${docs[i].CategoryCode}${docs[i].TypeCode}` : "",
      ref: docs[i]?.ID || "",
    })),
  };
}

export function buildExtractedDocuments(item: Record<string, unknown>): AdditionalDocumentInput[] {
  const docs: AdditionalDocumentInput[] = [];
  const invoiceReference = String(item.invoiceReference || item.invoiceNo || item.invoiceNumber || "").trim();
  const packingListReference = String(item.packingListReference || item.packingListRef || "").trim();
  if (invoiceReference) docs.push({ CategoryCode: "N", TypeCode: "935", ID: invoiceReference });
  if (packingListReference) docs.push({ CategoryCode: "N", TypeCode: "271", ID: packingListReference });
  return docs;
}
