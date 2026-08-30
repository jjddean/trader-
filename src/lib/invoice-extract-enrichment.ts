import {
  commodityRequiresSupplementaryUnit,
  SUPPLEMENTARY_UNIT_CODE_PST,
} from "./wco-mapper";

/** Raw line from Groq invoice extraction — invoice-observable fields only. */
export interface ExtractedInvoiceLine {
  commodityCode?: string;
  description?: string;
  originCountry?: string;
  valueAmount?: unknown;
  valueCurrency?: string;
  procedureCode?: string;
  additionalProcedureCode?: string;
  grossWeightKg?: unknown;
  netWeightKg?: unknown;
  supplementaryUnitQty?: unknown;
  quantity?: unknown;
  requiresSupplementaryUnit?: boolean | null;
  packageCount?: unknown;
  packageType?: string;
  shippingMarks?: string;
  invoiceNumber?: string;
  invoiceReference?: string;
  packingListReference?: string;
}

export interface EnrichedGoodsItemPayload {
  commodityCode?: string;
  description?: string;
  originCountry?: string;
  procedureCode?: string;
  additionalProcedureCode?: string;
  valueAmount?: number;
  valueCurrency?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  supplementaryUnitQty?: number;
  supplementaryUnitCode?: string;
  packageCount?: number;
  packageType?: string;
  shippingMarks?: string;
  additionalDocuments?: Array<{
    CategoryCode: string;
    TypeCode: string;
    ID: string;
    StatusCode?: string;
  }>;
}

function positiveNumber(value: unknown): number | undefined {
  const raw = typeof value === "string" ? value.trim() : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function buildAdditionalDocument(typeCode: string, reference: string) {
  const id = reference.trim();
  if (!id) return undefined;
  return { CategoryCode: "N", TypeCode: typeCode, StatusCode: "AC", ID: id };
}

/**
 * Normalize evidence-backed values after AI invoice extraction.
 * Missing customs facts remain missing for user/rule-engine review.
 */
export function enrichExtractedLine(
  line: ExtractedInvoiceLine,
  opts?: { invoiceNumber?: string },
): EnrichedGoodsItemPayload {
  const out: EnrichedGoodsItemPayload = {};

  const commodityCode = String(line.commodityCode ?? "").trim();
  const description = String(line.description ?? "").trim();
  const originCountry = String(line.originCountry ?? "").trim().toUpperCase();
  const valueAmount = positiveNumber(line.valueAmount);
  const valueCurrency = String(line.valueCurrency ?? "").trim().toUpperCase();

  if (commodityCode) out.commodityCode = commodityCode;
  if (description) out.description = description;
  if (originCountry) out.originCountry = originCountry;
  if (valueAmount) out.valueAmount = valueAmount;
  if (valueCurrency) out.valueCurrency = valueCurrency;

  const grossWeightKg = positiveNumber(line.grossWeightKg);
  const netWeightKg = positiveNumber(line.netWeightKg);
  if (grossWeightKg) out.grossWeightKg = grossWeightKg;
  if (netWeightKg) out.netWeightKg = netWeightKg;

  const supplementaryUnitQty = positiveNumber(line.supplementaryUnitQty);
  if (supplementaryUnitQty) {
    out.supplementaryUnitQty = supplementaryUnitQty;
    out.supplementaryUnitCode = SUPPLEMENTARY_UNIT_CODE_PST;
  } else if (commodityRequiresSupplementaryUnit(commodityCode, line)) {
    const quantity = positiveNumber(line.quantity);
    if (quantity) {
      out.supplementaryUnitQty = quantity;
      out.supplementaryUnitCode = SUPPLEMENTARY_UNIT_CODE_PST;
    }
  }

  const procedureCode = String(line.procedureCode ?? "").trim();
  const additionalProcedureCode = String(line.additionalProcedureCode ?? "").trim();
  if (procedureCode) out.procedureCode = procedureCode;
  if (additionalProcedureCode) out.additionalProcedureCode = additionalProcedureCode;

  const packageCount = positiveNumber(line.packageCount);
  const packageType = String(line.packageType ?? "").trim().toUpperCase();
  const shippingMarks = String(line.shippingMarks ?? "").trim();
  if (packageCount) out.packageCount = packageCount;
  if (packageType) out.packageType = packageType;
  if (shippingMarks) out.shippingMarks = shippingMarks;

  const extractedInvoiceRef = String(line.invoiceReference ?? line.invoiceNumber ?? "").trim();
  const invoiceRef = extractedInvoiceRef || String(opts?.invoiceNumber ?? "").trim();
  const packingListRef = String(line.packingListReference ?? "").trim();
  const documents = [
    buildAdditionalDocument("935", invoiceRef),
    buildAdditionalDocument("271", packingListRef),
  ].filter((document): document is NonNullable<typeof document> => document != null);
  if (documents.length > 0) out.additionalDocuments = documents;

  return out;
}
