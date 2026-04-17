/**
 * Utility functions for document type inference, naming, and status normalization.
 * This is the shared document taxonomy used by the documents page and compliance tools.
 */

export const DOCUMENT_TYPES = [
  { code: "N935", name: "Commercial invoice / Origin declaration" },
  { code: "N271", name: "Packing list" },
  { code: "N864", name: "Certificate of origin" },
  { code: "N865", name: "Form A - Certificate of Origin" },
  { code: "N703", name: "Bill of lading" },
  { code: "C400", name: "Licence" },
  { code: "U166", name: "Statement on Origin (REX)" },
  { code: "U101", name: "Registered Exporter System (REX)" },
  { code: "U164", name: "EUR.1 Movement Certificate" },
  { code: "9100", name: "Rules of Origin Statement" },
  { code: "ZZZ", name: "Other" },
];

export type ShipmentType = "STANDARD" | "EXPORT" | "CONTROLLED";
export type RequirementLevel = "blocking" | "advisory";
export type RequirementRule = {
  code: string;
  requirementLevel: RequirementLevel;
  deReference: string;
  hmrcGuidance?: string;
};

const DCTS_FORM_A_COUNTRIES = new Set(["BD", "PK", "LK", "KE", "GH", "NG", "TZ", "UG", "ZM", "ZW"]);

export const REQUIRED_DOCS: Record<ShipmentType, RequirementRule[]> = {
  STANDARD: [
    { code: "N935", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Commercial invoice to evidence customs value." },
    { code: "N271", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Packing list supports package and weight checks." },
  ],
  EXPORT: [
    { code: "N935", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Commercial invoice to evidence customs value." },
    { code: "N271", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Packing list supports package and weight checks." },
    { code: "9100", requirementLevel: "advisory", deReference: "DE 2/3", hmrcGuidance: "Rules of origin statement where preference may apply." },
  ],
  CONTROLLED: [
    { code: "N935", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Commercial invoice to evidence customs value." },
    { code: "C400", requirementLevel: "blocking", deReference: "DE 2/3", hmrcGuidance: "Licence/permit evidence for controlled goods." },
  ],
};

const DOCUMENT_TYPE_NAME_MAP: Record<string, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((type) => [type.code, type.name]),
);

export function inferDocTypeCode(fileName: string): string {
  const upperName = fileName.toUpperCase();
  if (upperName.includes("EUR1") || upperName.includes("EUR.1")) return "U164";
  if (upperName.includes("REX") || upperName.includes("STATEMENT ON ORIGIN")) return "U166";
  if (upperName.includes("RULES OF ORIGIN") || upperName.includes("ORIGIN STATEMENT")) return "9100";
  if (upperName.includes("INVOICE") || upperName.startsWith("INV")) return "N935";
  if (upperName.includes("PACK") || upperName.startsWith("PL-")) return "N271";
  if (upperName.includes("FORM A")) return "N865";
  if (upperName.includes("ORIGIN") || upperName.includes("CERT")) return "N864";
  if (upperName.includes("BOL") || upperName.includes("LADING")) return "N703";
  if (upperName.includes("LIC")) return "C400";
  return "ZZZ";
}

export function docTypeName(code: string): string {
  return DOCUMENT_TYPE_NAME_MAP[code] || "Other";
}

export function normalizeDocStatus(status: string): "verified" | "missing" | "review" {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("clean") || normalized.includes("verified") || normalized.includes("accepted")) return "verified";
  if (normalized.includes("missing")) return "missing";
  if (normalized.includes("review") || normalized.includes("flag") || normalized.includes("pending")) return "review";
  return "review";
}

export function deriveShipmentTypeFromDeclaration(declaration: {
  declarationType?: string;
  route?: string;
  status?: string;
}): ShipmentType {
  const declarationType = String(declaration?.declarationType || "").toUpperCase();
  const route = String(declaration?.route || "").toUpperCase();

  if (declarationType.includes("EX") || declarationType.includes("EXPORT")) return "EXPORT";
  if (route.includes("CONTROL") || route.includes("LICENCE") || route.includes("LICENSE")) return "CONTROLLED";
  return "STANDARD";
}

export function getRequiredDocsForShipmentType(shipmentType: ShipmentType) {
  return (REQUIRED_DOCS[shipmentType] || []).map((rule: RequirementRule) => ({
    code: rule.code,
    name: docTypeName(rule.code),
    type: "Required",
    source: "shipment_rules",
    requirementLevel: rule.requirementLevel,
    deReference: rule.deReference,
    hmrcGuidance: rule.hmrcGuidance,
  }));
}

function getAgreementAwareOriginEvidence(declaration: {
  route?: string;
  declarationType?: string;
  dispatchCountry?: string;
  destinationCountry?: string;
}) {
  const route = String(declaration?.route || "").toUpperCase();
  const declarationType = String(declaration?.declarationType || "").toUpperCase();
  const dispatchCountry = String(declaration?.dispatchCountry || "").toUpperCase();
  const destinationCountry = String(declaration?.destinationCountry || "").toUpperCase();

  const isExportLike = route.includes("EXPORT") || declarationType.startsWith("EX") || destinationCountry !== "GB";
  if (!isExportLike) return [];

  const advisoryRules: RequirementRule[] = [
    {
      code: "U166",
      requirementLevel: "advisory",
      deReference: "DE 2/3",
      hmrcGuidance: "Statement on origin (REX) for preferential claims where applicable.",
    },
    {
      code: "U164",
      requirementLevel: "advisory",
      deReference: "DE 2/3",
      hmrcGuidance: "EUR.1 movement certificate where agreement route requires certificate evidence.",
    },
    {
      code: "U101",
      requirementLevel: "advisory",
      deReference: "DE 2/3",
      hmrcGuidance: "Registered exporter details may be required for origin proof routes.",
    },
  ];

  if (DCTS_FORM_A_COUNTRIES.has(dispatchCountry)) {
    advisoryRules.push({
      code: "N865",
      requirementLevel: "advisory",
      deReference: "DE 2/3",
      hmrcGuidance: "Form A certificate may support DCTS-style origin preference evidence.",
    });
  } else {
    advisoryRules.push({
      code: "N864",
      requirementLevel: "advisory",
      deReference: "DE 2/3",
      hmrcGuidance: "Certificate of origin can support non-preferential/proof checks.",
    });
  }

  return advisoryRules;
}

export function getHmrcRequirementSetForDeclaration(declaration: {
  declarationType?: string;
  route?: string;
  status?: string;
  dispatchCountry?: string;
  destinationCountry?: string;
}) {
  const shipmentType = deriveShipmentTypeFromDeclaration(declaration);
  const base = getRequiredDocsForShipmentType(shipmentType);
  const originEvidence = getAgreementAwareOriginEvidence(declaration);
  const merged = [...base];

  for (const rule of originEvidence) {
    if (!merged.some((existing) => existing.code === rule.code)) {
      merged.push({
        code: rule.code,
        name: docTypeName(rule.code),
        type: "Required",
        source: "hmrc_origin_mapping",
        requirementLevel: rule.requirementLevel,
        deReference: rule.deReference,
        hmrcGuidance: rule.hmrcGuidance,
      });
    }
  }

  return merged;
}

export function validateDocumentForCode(params: {
  code: string;
  fileName?: string;
  ocrText?: string;
}): { valid: boolean; message?: string } {
  const code = String(params.code || "").toUpperCase();
  const fileName = String(params.fileName || "").toUpperCase();
  const text = String(params.ocrText || "").toUpperCase();

  if (code === "N935") {
    const ok = /INVOICE|COMMERCIAL/.test(fileName) || /INVOICE|SELLER|BUYER|TOTAL/.test(text);
    return ok ? { valid: true } : { valid: false, message: "Invoice markers missing (seller/buyer/total)." };
  }
  if (code === "N271") {
    const ok = /PACK/.test(fileName) || /PACKING LIST|CARTON|GROSS WEIGHT|NET WEIGHT/.test(text);
    return ok ? { valid: true } : { valid: false, message: "Packing-list markers missing (carton/weights)." };
  }
  if (code === "C400") {
    const ok = /LICEN[CS]E|PERMIT|AUTHORISATION/.test(fileName) || /LICEN[CS]E|PERMIT|AUTHORISATION/.test(text);
    return ok ? { valid: true } : { valid: false, message: "Licence or permit reference not found." };
  }
  if (code === "9100") {
    const ok = /RULES OF ORIGIN|ORIGIN STATEMENT|PREFERENTIAL/.test(fileName) || /RULES OF ORIGIN|ORIGIN STATEMENT|PREFERENTIAL/.test(text);
    return ok ? { valid: true } : { valid: false, message: "Rules-of-origin declaration text missing." };
  }
  return { valid: true };
}

export function buildGeneratedTemplate(params: {
  code: string;
  declaration: {
    mrn?: string;
    eori?: string;
    declarationType?: string;
    lastUpdated?: number;
  };
  userName?: string;
}) {
  const dateIso = new Date(params.declaration?.lastUpdated || Date.now()).toISOString().slice(0, 10);
  const mrn = params.declaration?.mrn || "DRAFT";
  const eori = params.declaration?.eori || "GBXXXXXXXXXXXX";
  const declarationType = params.declaration?.declarationType || "IM";
  const preparedBy = params.userName || "Declarant";

  switch (String(params.code).toUpperCase()) {
    case "N935":
      return {
        fileName: `Commercial_Invoice_${mrn}.txt`,
        text: `COMMERCIAL INVOICE\nDate: ${dateIso}\nMRN: ${mrn}\nEORI: ${eori}\nDeclaration Type: ${declarationType}\nSeller: [ENTER SELLER]\nBuyer: [ENTER BUYER]\nInvoice Currency: GBP\nTotal Invoice Value: [ENTER TOTAL]\nTerms: [INCOTERMS]\nPrepared by: ${preparedBy}\n`,
      };
    case "N271":
      return {
        fileName: `Packing_List_${mrn}.txt`,
        text: `PACKING LIST\nDate: ${dateIso}\nMRN: ${mrn}\nEORI: ${eori}\nConsignee: [ENTER CONSIGNEE]\nPackage Count: [ENTER COUNT]\nGross Weight (kg): [ENTER]\nNet Weight (kg): [ENTER]\nMarks & Numbers: [ENTER]\nPrepared by: ${preparedBy}\n`,
      };
    case "9100":
      return {
        fileName: `Rules_of_Origin_Statement_${mrn}.txt`,
        text: `RULES OF ORIGIN STATEMENT\nDate: ${dateIso}\nMRN: ${mrn}\nExporter EORI: ${eori}\nStatement: The products covered by this document originate in [COUNTRY] and satisfy the relevant rules of origin.\nReference: [ENTER AGREEMENT / ARTICLE]\nAuthorized Signatory: ${preparedBy}\n`,
      };
    case "U166":
      return {
        fileName: `Statement_on_Origin_REX_${mrn}.txt`,
        text: `STATEMENT ON ORIGIN (REX)\nDate: ${dateIso}\nMRN: ${mrn}\nExporter REX Number: [ENTER REX NUMBER]\nExporter EORI: ${eori}\nText: The exporter of the products covered by this document declares that, except where otherwise clearly indicated, these products are of preferential origin.\nSignature: ${preparedBy}\n`,
      };
    default:
      return {
        fileName: `Generated_${params.code}_${mrn}.txt`,
        text: `DOCUMENT TEMPLATE\nCode: ${params.code}\nDate: ${dateIso}\nMRN: ${mrn}\nEORI: ${eori}\nPrepared by: ${preparedBy}\n[COMPLETE REQUIRED FIELDS]\n`,
      };
  }
}
