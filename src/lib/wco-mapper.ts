import { countries } from "./data/countries";
import { buildInventoryPreviousDocument } from "./cns/inventory-xml";
import { resolveGoodsLocationForXml } from "./goods-location";
import {
  buildDefermentAdditionalDocument,
  resolveDeclarationPayment,
  validatePaymentFields,
} from "./payment-method";

// validateCdsFields was deleted. The submit route already runs evaluateRules
// from convex/lib/rule_engine.ts before mapping — that is the single source
// of validation. Adding a new check = adding a rule to rule_definitions
// (or seeding via convex/rule_seed.ts), NOT adding a function here.

/**
 * Map declaration type letter + route to WCO TypeCode.
 * Import types: IMA, IMB, IMC, IMD, IME, IMF, IMJ, IMK, IMY, IMZ
 * Export types: EXA, EXB, etc.
 * Defaults to IMA (standard frontier import) if unspecified.
 */
export function mapDeclarationType(type?: string, route?: string): string {
  const prefix = route === "export" ? "EX" : "IM";
  const validTypes = ["A", "B", "C", "D", "E", "F", "J", "K", "Y", "Z"];
  const suffix = validTypes.includes((type || "").toUpperCase()) 
    ? (type || "A").toUpperCase() 
    : "A";
  return `${prefix}${suffix}`;
}

// Format mass measures to 3 decimal places (CDS DE 6/1, 6/5).
export function formatMass(value: unknown): string {
  const n = parseFloat(String(value ?? ""));
  return (isFinite(n) && n > 0 ? n : 0).toFixed(3);
}

// Clamp net to <= gross. CDS rejects when item net mass exceeds declared gross mass.
export function clampNetToGross(net: unknown, gross: unknown): string {
  const g = parseFloat(String(gross ?? ""));
  const n = parseFloat(String(net ?? ""));
  const grossNum = isFinite(g) && g > 0 ? g : 0;
  const netNum = isFinite(n) && n > 0 ? n : grossNum;
  return (netNum > grossNum ? grossNum : netNum).toFixed(3);
}

// Format monetary amounts to 2 decimal places (CDS DE 4/11, 4/14).
export function formatAmount(value: unknown): string {
  const n = parseFloat(String(value ?? ""));
  return (isFinite(n) && n > 0 ? n : 0).toFixed(2);
}

// DE 6/2 — supplementary units (n..16,6 per Group 6). Must be > 0 when declared.
export function formatSupplementaryQty(value: unknown): string | null {
  const n = parseFloat(String(value ?? ""));
  if (!isFinite(n) || n <= 0) return null;
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, "") || "0";
}

/** UK tariff p/st → measurement unit code NAR (UK Tariff Data Standard). */
export const SUPPLEMENTARY_UNIT_CODE_PST = "NAR";

/** Commodity codes in active lane that require DE 6/2 per UK Integrated Online Tariff. */
export const HS_REQUIRES_SUPPLEMENTARY_UNIT = new Set(["8471300000"]);

export function commodityRequiresSupplementaryUnit(commodityCode: unknown): boolean {
  const normalized = String(commodityCode ?? "").replace(/\D/g, "");
  return HS_REQUIRES_SUPPLEMENTARY_UNIT.has(normalized);
}

// Strip ALL whitespace from transport identifiers (DE 7/9). CDS R123 rejects
// vessel/wagon IDs containing spaces.
export function stripTransportId(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "");
}

export function commodityClassifications(codeValue: unknown) {
  const code = String(codeValue || "").replace(/\s+/g, "");
  if (/^\d{10}$/.test(code)) {
    return [
      { ID: code.substring(0, 8), IdentificationTypeCode: "TSP" },
      { ID: code.substring(8, 10), IdentificationTypeCode: "TRC" },
    ];
  }
  return code ? [{ ID: code, IdentificationTypeCode: "TSP" }] : [];
}

export function normalizeCountryCode(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  const prefix = upper.match(/^([A-Z]{2})\b/);
  if (prefix) return prefix[1];
  const paren = upper.match(/\(([A-Z]{2})\)/);
  if (paren) return paren[1];
  const byName = countries.find(
    (c) => c.name.toUpperCase() === upper || c.code.toUpperCase() === upper,
  );
  if (byName) return byName.code;
  return "";
}

/** True when dispatch ≠ GB/XI and no GB/XI exporter EORI applies. */
export function requiresOverseasExporterAddress(declaration: { dispatchCountry?: unknown; exporterEori?: unknown }): boolean {
  const dispatch = normalizeCountryCode(declaration.dispatchCountry);
  if (!dispatch || dispatch === "GB" || dispatch === "XI") return false;
  const eori = String(declaration.exporterEori || "").trim();
  return !/^(GB|XI)\d{12}$/i.test(eori);
}

/** Validate DE 8/5 nature of transaction — no silent mapper default. */
export function validateTransactionNatureCode(declaration: Record<string, unknown>): string[] {
  const code = String(declaration.transactionNatureCode ?? "").trim();
  if (!code) {
    return ["Missing transaction nature code (DE 8/5)"];
  }
  return [];
}

/** Validate DE 3/1 overseas exporter Name+Address — no silent mapper defaults. */
export function validateOverseasExporter(declaration: Record<string, unknown>): string[] {
  if (!requiresOverseasExporterAddress(declaration)) return [];
  const fields: [string, string][] = [
    ["exporterName", "Exporter name (DE 3/1)"],
    ["exporterCity", "Exporter city (DE 3/1)"],
    ["exporterLine", "Exporter address line (DE 3/1)"],
    ["exporterPostcode", "Exporter postcode (DE 3/1)"],
  ];
  return fields
    .filter(([key]) => !String(declaration[key] ?? "").trim())
    .map(([, label]) => `Missing ${label} for overseas dispatch`);
}

/**
 * DE 4/9 AdditionCode — emit only when compatible with DE 4/1 Incoterm.
 * DMSACC baseline FC-MPYAJ7RN: CIF + 0000. CDS12100 rejects incompatible pairs.
 */
export function resolveValuationAdditionCode(declaration: {
  incoterms?: unknown;
  valuationAdditionCode?: unknown;
}): string | null {
  const explicit = String(declaration.valuationAdditionCode ?? "").trim();
  if (explicit) return explicit;

  const incoterm = String(declaration.incoterms ?? "").trim().toUpperCase();
  if (!incoterm) return null;

  const WITH_NIL_ADDITION = new Set(["CIF", "CIP", "DAP", "DPU", "DDP"]);
  if (WITH_NIL_ADDITION.has(incoterm)) return "0000";

  return null;
}

function buildOverseasExporterBlock(declaration: Record<string, unknown>) {
  const errors = validateOverseasExporter(declaration);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  const dispatch = normalizeCountryCode(declaration.dispatchCountry);
  return {
    Exporter: {
      Name: String(declaration.exporterName).trim(),
      Address: {
        CityName: String(declaration.exporterCity).trim(),
        CountryCode: dispatch,
        Line: String(declaration.exporterLine).trim(),
        PostcodeID: String(declaration.exporterPostcode).trim(),
      },
    },
  };
}

function resolveGoodsLocation(declaration: any) {
  return resolveGoodsLocationForXml(declaration);
}

/**
 * DE 4/1 second component — location up to which incoterms apply.
 * Source: Group 4 completion guide (retrieved 2026-05-31) — for method 1 declarations
 * the delivery terms code must be provided; location is country a2 + place name when
 * no UN/LOCODE exists (e.g. CIFGBCanewdon), or GB-prefixed UN/LOCODE from Appendix 16I.
 */
export function resolveTradeTermsLocationId(declaration: {
  incoterms?: unknown;
  incotermLocation?: unknown;
  destinationCountry?: unknown;
}): string {
  const incoterm = String(declaration.incoterms || "").trim().toUpperCase();
  if (!incoterm) return "";

  const dest = normalizeCountryCode(declaration.destinationCountry) || "GB";
  const raw = String(declaration.incotermLocation || "").trim();
  if (raw) {
    const compact = raw.toUpperCase().replace(/\s+/g, "");
    if (/^GB[A-Z0-9]{2,35}$/.test(compact)) return compact;
    if (/^[A-Z]{3,17}$/.test(compact)) return `${dest}${compact}`;
    const alnum = raw.replace(/[^A-Za-z0-9]/g, "");
    if (alnum) return `${dest}${alnum}`;
  }

  // No fallback. A hardcoded default (this previously returned GBFELIXSTOWE for
  // any CIF-to-GB lane) silently declares a place the goods were never at —
  // e.g. a London Gateway consignment declaring Felixstowe in DE 4/1 while
  // DE 5/23 says otherwise. Missing input is caught by
  // validateTradeTermsLocation at submit time instead.
  return "";
}

/**
 * DE 4/1 — delivery terms code and location.
 *
 * The mapper declares CustomsValuation MethodCode 1 (transaction value), and
 * the Group 4 completion guide requires the delivery terms for method 1. Both
 * halves are therefore mandatory here.
 *
 * Without this check a missing incoterm surfaced as the XML preflight failure
 * "no_empty_tags" — technically true (TradeTerms rendered an empty
 * ConditionCode) but giving the operator no idea which field to fill in.
 */
export function validateTradeTerms(declaration: {
  incoterms?: unknown;
  incotermLocation?: unknown;
  destinationCountry?: unknown;
}): string[] {
  const errors: string[] = [];
  const incoterm = String(declaration.incoterms || "").trim();

  if (!incoterm) {
    errors.push("Missing incoterms delivery terms code (DE 4/1), e.g. CIF.");
    return errors;
  }

  if (!resolveTradeTermsLocationId(declaration)) {
    errors.push(
      "Missing incoterm location (DE 4/1) — required alongside the delivery terms code for method-1 valuation.",
    );
  }
  return errors;
}

// Async lookup signature — the route passes a function backed by the Convex
// `cds_codes:validateCodes` query, so the mapper module stays Convex-free.
// Returns the subset of values that are NOT present in the named code list.
export type CodeListLookup = (listName: string, values: string[]) => Promise<string[]>;

// List names must match those seeded by `convex/actions/cds_codes.ts`.
const LIST = {
  additionalDocuments: "additional_documents",
  procedureCodes: "procedure_codes",
  previousProcedureCodes: "previous_procedure_codes",
  customsOffices: "customs_offices",
  packageTypes: "package_types",
  transportModes: "transport_modes",
  transportIdTypes: "transport_id_types",
  incoterms: "incoterms",
  previousDocumentTypes: "previous_document_types",
  valuationMethods: "valuation_methods",
  authCategories: "auth_categories",
} as const;

// Validate every code-list-bound value in the mapper output against the
// authoritative HMRC datasets. Returns one error per invented/unknown code.
// Method 1 valuation has a special invariant: it requires N935 on the items.
export interface CodeListValidationOptions {
  /**
   * Which data set is being validated. Only the import lists are seeded, so an
   * export declaration must not be measured against them.
   */
  category?: "H1" | "I1" | "B1" | "C1";
}

export async function validateCdsCodeLists(
  payloadInfo: any,
  items: any[],
  lookup: CodeListLookup,
  options: CodeListValidationOptions = {},
): Promise<{ field: string; reason: string }[]> {
  const isExportDataSet = options.category === "B1" || options.category === "C1";
  const errors: { field: string; reason: string }[] = [];
  const decl = payloadInfo?.Declaration ?? {};
  const shipment = decl?.GoodsShipment ?? {};

  const officeId = String(decl?.DeclarationOfficeID || "");
  if (officeId) {
    const missing = await lookup(LIST.customsOffices, [officeId]);
    if (missing.length) {
      errors.push({
        field: "presentationOffice",
        reason: `DeclarationOfficeID '${officeId}' is not in the HMRC customs offices list (DE 5/26).`,
      });
    }
  }

  const incoterm = String(shipment?.TradeTerms?.ConditionCode || "");
  if (incoterm) {
    const missing = await lookup(LIST.incoterms, [incoterm]);
    if (missing.length) {
      errors.push({
        field: "incoterms",
        reason: `Incoterm '${incoterm}' is not in the HMRC incoterms list (DE 4/1).`,
      });
    }
  }

  const transportMode = String(decl?.BorderTransportMeans?.ModeCode || "");
  if (transportMode) {
    const missing = await lookup(LIST.transportModes, [transportMode]);
    if (missing.length) {
      errors.push({
        field: "transportMode",
        reason: `Transport mode '${transportMode}' is not in the HMRC mode-of-transport list (DE 7/4).`,
      });
    }
  }

  const transportIdType = String(decl?.BorderTransportMeans?.IdentificationTypeCode || "");
  if (transportIdType) {
    const missing = await lookup(LIST.transportIdTypes, [transportIdType]);
    if (missing.length) {
      errors.push({
        field: "transportIdType",
        reason: `Transport ID type '${transportIdType}' is not in the HMRC transport-means-id list (DE 7/7).`,
      });
    }
  }

  const previousDocs = Array.isArray(shipment?.PreviousDocument) ? shipment.PreviousDocument : [];
  const prevTypes = previousDocs.map((d: any) => String(d?.TypeCode || "")).filter(Boolean);
  if (prevTypes.length) {
    const missing = await lookup(LIST.previousDocumentTypes, prevTypes);
    for (const code of missing) {
      errors.push({
        field: "previousDocument.typeCode",
        reason: `Previous document type '${code}' is not in the HMRC previous-document-types list (DE 2/1).`,
      });
    }
  }

  const goodsItems = Array.isArray(shipment?.GovernmentAgencyGoodsItem) ? shipment.GovernmentAgencyGoodsItem : [];
  for (let i = 0; i < goodsItems.length; i++) {
    const gi = goodsItems[i];
    const fieldPrefix = `items[${i}]`;

    const valuationMethod = String(gi?.CustomsValuation?.MethodCode || "");
    if (valuationMethod) {
      const missing = await lookup(LIST.valuationMethods, [valuationMethod]);
      if (missing.length) {
        errors.push({
          field: `${fieldPrefix}.valuationMethod`,
          reason: `Valuation method '${valuationMethod}' is not in the HMRC valuation-method-types list (DE 4/16).`,
        });
      }
    }

    // DE 1/10 splits as two 2-digit codes: requested ("40") + previous ("00").
    // wco-dec ships them in separate files; the additional procedure code
    // (DE 1/11, 3 digits like "000") is HMRC-specific and not in the WCO repo,
    // so it's deferred to Stage 2 (UK Tariff API).
    const procPair = String(items[i]?.procedureCode || "").replace(/\s+/g, "");
    if (/^\d{4}$/.test(procPair)) {
      const current = procPair.substring(0, 2);
      const previous = procPair.substring(2, 4);
      const missingCurrent = await lookup(LIST.procedureCodes, [current]);
      if (missingCurrent.length) {
        errors.push({
          field: `${fieldPrefix}.procedureCode`,
          reason: `Requested procedure '${current}' is not in the HMRC government-procedure-types list (DE 1/10 first pair).`,
        });
      }
      // `previous_procedure_codes` is seeded from HMRC's *import*
      // previous-procedures file (see convex/actions/cds_codes.ts). Measuring
      // an export declaration against it rejects valid export procedure codes
      // — 1040 is a standard permanent export, but "40" is not an import
      // previous procedure. Skipped until the export list is seeded, matching
      // how the route already fails open on an unseeded list.
      if (!isExportDataSet) {
        const missingPrevious = await lookup(LIST.previousProcedureCodes, [previous]);
        if (missingPrevious.length) {
          errors.push({
            field: `${fieldPrefix}.procedureCode`,
            reason: `Previous procedure '${previous}' is not in the HMRC import-previous-procedures list (DE 1/10 second pair).`,
          });
        }
      }
    }

    const packaging = Array.isArray(gi?.Packaging) ? gi.Packaging : [];
    const pkgTypes = packaging.map((p: any) => String(p?.TypeCode || "")).filter(Boolean);
    if (pkgTypes.length) {
      const missing = await lookup(LIST.packageTypes, pkgTypes);
      for (const code of missing) {
        errors.push({
          field: `${fieldPrefix}.packageType`,
          reason: `Package type '${code}' is not in the HMRC package-types list (DE 6/9).`,
        });
      }
    }

    // wco-dec stores additional documents as combined CategoryCode+TypeCode
    // values (e.g. "N935", "Y929") — our XML splits them across two elements
    // so we have to recombine before lookup.
    const addlDocs = Array.isArray(gi?.AdditionalDocument) ? gi.AdditionalDocument : [];
    const combinedDocCodes = addlDocs
      .map((d: any) => `${String(d?.CategoryCode || "").trim()}${String(d?.TypeCode || "").trim()}`)
      .filter((c: string) => c.length > 0);
    if (combinedDocCodes.length) {
      const missing = await lookup(LIST.additionalDocuments, combinedDocCodes);
      for (const code of missing) {
        errors.push({
          field: `${fieldPrefix}.additionalDocument`,
          reason: `Additional document '${code}' is not in the HMRC additional-documents list (DE 2/3).`,
        });
      }
    }

    // Method 1 (transaction value) requires N935 — the commercial invoice.
    // This is documented on valuation-method-types.json in the wco-dec source.
    if (valuationMethod === "1") {
      const hasN935 = combinedDocCodes.some((c: string) => c.toUpperCase() === "N935");
      if (!hasN935) {
        errors.push({
          field: `${fieldPrefix}.additionalDocument`,
          reason: "Valuation method 1 (transaction value) requires AdditionalDocument N935 (commercial invoice).",
        });
      }
    }
  }

  return errors;
}

export interface MapOptions {
  // When true, suppress all <AdditionalDocument> nodes — used for the
  // "minimal payload" baseline submission to isolate structural errors
  // from document/attribute errors.
  omitAdditionalDocuments?: boolean;
  // Defence-in-depth: even if a forbidden document survived validation
  // (e.g. rules disabled, advisory-only), the mapper drops it before
  // emission. Codes are CategoryCode+TypeCode concatenated, e.g. "D006".
  forbiddenDocCodes?: string[];
  // CNS inventory-linked imports only. When set, a second DE 2/1 previous
  // document carrying the inventory reference (Z/MCR) is emitted alongside the
  // DUCR so the CSP can match the declaration to its inventory record.
  // Absent on every direct-HMRC declaration.
  cnsUcn?: string;
}

/**
 * DE 3/19–3/21 representative block (WCO `Agent`).
 *
 * Per the CDS Group 3 completion guide: DE 3/19 (name/address) and DE 3/20
 * (EORI) are only declared where the Representative *differs* from the Declarant
 * (DE 3/18) — the sub-agent case. In the normal flow the account holder is the
 * representative acting as declarant, so only the DE 3/21 status code is emitted
 * (code 2 = direct, 3 = indirect). Self-representation emits no Agent at all.
 */
function buildRepresentativeAgentBlock(declaration: any) {
  const type = String(declaration.representationType || "self").trim();
  if (type !== "direct" && type !== "indirect") return {};

  const functionCode = type === "indirect" ? "3" : "2";
  const declarantEori = String(declaration.eori || "").trim().toUpperCase();
  const repEori = String(declaration.representativeEori || "").trim().toUpperCase();
  const repName = String(declaration.representativeName || "").trim();

  // Representative differs from the declarant only when a distinct EORI is given,
  // or a name is given with no EORI. Otherwise the representative IS the declarant.
  const representativeDiffersFromDeclarant =
    (Boolean(repEori) && repEori !== declarantEori) || (!repEori && Boolean(repName));

  if (!representativeDiffersFromDeclarant) {
    // DE 3/21 status code only — DE 3/19/3/20 left blank (representative = declarant).
    return { Agent: { FunctionCode: functionCode } };
  }

  if (repEori) {
    // DE 3/20 — representative EORI (distinct from declarant).
    return { Agent: { ID: repEori, FunctionCode: functionCode } };
  }

  // DE 3/19 — distinct representative without an EORI: full name + address required.
  const line = String(declaration.representativeAddressLine || "").trim();
  const city = String(declaration.representativeCity || "").trim();
  const postcode = String(declaration.representativePostcode || "").trim();
  const country = normalizeCountryCode(declaration.representativeCountry);
  if (!line || !city || !postcode || !country) {
    throw new Error("Representative EORI or full representative name and address is required for DE 3/19-3/21.");
  }

  return {
    Agent: {
      Name: repName,
      FunctionCode: functionCode,
      Address: {
        CityName: city,
        CountryCode: country,
        Line: line,
        PostcodeID: postcode,
      },
    },
  };
}
export function mapToCDS_H1(declaration: any, items: any[], options: MapOptions = {}) {
  if (!declaration || typeof declaration !== "object") {
    throw new Error("Invalid declaration object provided to H1 mapper.");
  }

  // Sums must come from real item data. No silent fallbacks: a zero-value or
  // zero-mass declaration must FAIL validation upstream, not be papered over
  // with magic 100/1000 placeholders that survive into CDS.
  const totalGrossWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.grossWeightKg) || 0), 0);
  const itemValueSum = items.reduce((acc: number, item: any) => acc + (parseFloat(item.valueAmount) || 0), 0);
  const invoiceTotal = parseFloat(String(declaration.invoiceTotal ?? "")) || itemValueSum;
  if (!declaration.eori || !declaration._id) {
    throw new Error("Declaration is missing eori or _id; cannot derive DUCR.");
  }
  const ducr = declaration.ducr || `${new Date().getFullYear() % 10}GB${String(declaration.eori).trim().replace(/^GB/i, "")}-${declaration._id.substring(0,6).toUpperCase()}`;
  const declarantEori = String(declaration.eori || "").trim();
  const declaredRepType = String(declaration.representationType || "self").trim();
  // Under direct/indirect representation the importer is a distinct party (the
  // represented person) and must never silently inherit the declarant's EORI —
  // doing so mis-states DE 3/16 and collides with the self-rep AI 00500 below.
  const importerEori = declaredRepType === "self"
    ? String(declaration.importerEori || declaration.eori || "").trim()
    : String(declaration.importerEori || "").trim();
  // DE 2/2 AI 00500 ("Identity between declarant and importer") only applies to
  // genuine self-representation. Per the Group 3 completion guide, when a
  // representative is used (DE 3/21 = 2 or 3) the importer differs from the
  // declarant and 00500 must NOT be declared.
  const isSelfRepresentation =
    declaredRepType === "self" && Boolean(declarantEori) && declarantEori === importerEori;

  // DE 7/10 — container id. Whitespace stripped and upper-cased: CSP inventory
  // records hold the ISO container number with no separators, and a mismatch
  // here fails the pre-check rather than the schema.
  const containerNumber = String(declaration.containerNumber ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();

  const paymentError = validatePaymentFields(
    declaration.paymentMethodCode,
    declaration.defermentAccountNumber,
  );
  if (paymentError) {
    throw new Error(paymentError);
  }
  const { dan, mop } = resolveDeclarationPayment(declaration);
  const headerDefermentDocs = dan ? [buildDefermentAdditionalDocument(dan)] : [];
  const dutyTaxFeeMethod = mop ? { MethodCode: mop } : {};

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: mapDeclarationType(
        declaration.additionalDeclarationType || declaration.declarationType,
        declaration.route,
      ),
      FunctionalReferenceID: declaration.lrn || `FC-${Date.now().toString(36).toUpperCase()}`,
      GoodsItemQuantity: items.length,
      DeclarationOfficeID: declaration.presentationOffice || "",
      TotalGrossMassMeasure: formatMass(declaration.totalGrossWeight || totalGrossWeight),
      TotalPackageQuantity: items.reduce((acc: number, item: any) => acc + (parseInt(item.packageCount) || 0), 0),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "",
        value: formatAmount(invoiceTotal),
      },
      CurrencyExchange: {
        CurrencyTypeCode: declaration.invoiceCurrency || ""
      },
      // DE 7/14 + 7/15 — BorderTransportMeans at Declaration level (the means
      // crossing the UK border). For IMA imports CDS expects BOTH this AND
      // ArrivalTransportMeans inside Consignment — see R123. Both must carry
      // the full transport identity (ID + IdentificationTypeCode + ModeCode);
      // ModeCode-only fails CDS12073 + R123.
      BorderTransportMeans: {
        ID: stripTransportId(declaration.transportId || ""),
        IdentificationTypeCode: declaration.transportIdType || "",
        ModeCode: declaration.transportMode || "",
      },
      ...(headerDefermentDocs.length > 0 ? { AdditionalDocument: headerDefermentDocs } : {}),
      ...buildRepresentativeAgentBlock(declaration),
      Declarant: {
        ID: String(declaration.eori || "").trim()
      },
      // DE 3/1 Exporter: GB/XI EORI only for intra-UK/XI flows. For overseas imports
      // (dispatch country ≠ GB/XI) declare the foreign exporter by Name+Address.
      // CDS12073/57A fires when ExportCountry.ID and Origin.CountryCode both reference
      // a foreign country with no Exporter party to anchor the declaration.
      ...((() => {
        const dispatch = normalizeCountryCode(declaration.dispatchCountry);
        const eori = String(declaration.exporterEori || "").trim();
        if (/^(GB|XI)\d{12}$/i.test(eori) && (dispatch === "GB" || dispatch === "XI")) {
          return { Exporter: { ID: eori } };
        }
        if (requiresOverseasExporterAddress(declaration)) {
          return buildOverseasExporterBlock(declaration as Record<string, unknown>);
        }
        return {};
      })()),
      UCR: {
        TraderAssignedReferenceID: ducr
      },
      GoodsShipment: {
        // DE 3/26 Buyer and DE 3/24 Seller are omitted from XML (h1-xml-renderer).
        // Incomplete Address-only blocks trigger CDS12077/CDS10001; Seller with the
        // same country as Exporter triggers CDS12092/CDS12073 (cds_error_codes.ts).
        Consignment: {
           // WCO Consignment xs:sequence: ContainerCode comes BEFORE
           // ArrivalTransportMeans, which in turn comes before GoodsLocation
           // (per CDS schema rejection: after ArrivalTransportMeans only
           // DepartureTransportMeans/GoodsLocation/LoadingLocation/TransportEquipment
           // are valid).
           //
           // DE 7/2 — "1" when the goods are containerised, "0" when not.
           // Declaring "0" against a containerised consignment fails the CNS
           // inventory pre-check, which matches on the container number.
           ContainerCode: containerNumber ? "1" : "0",
           // DE 7/9 — ArrivalTransportMeans. Mirrors BorderTransportMeans
           // (R123 enforces matching identity at both layers).
           ArrivalTransportMeans: {
             ID: stripTransportId(declaration.transportId || ""),
             IdentificationTypeCode: declaration.transportIdType || "",
             ModeCode: declaration.transportMode || "",
           },
           GoodsLocation: resolveGoodsLocation(declaration),
           // DE 7/10 — container identification. Emitted only when declared;
           // WCO sequence places TransportEquipment after GoodsLocation.
           ...(containerNumber
             ? { TransportEquipment: [{ SequenceNumeric: "1", ID: containerNumber }] }
             : {}),
        },
        Destination: {
           CountryCode: normalizeCountryCode(declaration.destinationCountry)
        },
        ExportCountry: {
           ID: normalizeCountryCode(declaration.dispatchCountry)
        },
        Importer: {
           ID: importerEori
        },
        // DE 2/1 — Previous documents at GoodsShipment level. Always emit at
        // least the DUCR (CategoryCode Z, TypeCode DCR) so CDS can resolve the
        // 99A pointer chain.
        PreviousDocument: [
          {
            CategoryCode: "Z",
            TypeCode: "DCR",
            ID: ducr,
            LineNumeric: "1",
          },
          // DE 2/1 — CNS inventory reference (Z/MCR). Emitted only for the
          // inventory-linked route; the direct HMRC path is unchanged.
          ...(options.cnsUcn ? [buildInventoryPreviousDocument(options.cnsUcn)] : []),
        ],
        // CDS10020/22B/L002: LocationID must be omitted when blank — an empty string
        // fails code-list validation. ConditionCode (DE 4/1) is still required.
        // CDS10020/22B/L002: LocationID must be a valid code, not free text (e.g. "Felixstowe").
        TradeTerms: (() => {
          const conditionCode = declaration.incoterms || "";
          const locationId = resolveTradeTermsLocationId(declaration);
          return {
            ConditionCode: conditionCode,
            ...(locationId ? { LocationID: locationId } : {}),
          };
        })(),
        TransactionNatureCode: (() => {
          const code = String(declaration.transactionNatureCode ?? "").trim();
          if (!code) {
            throw new Error("Missing transaction nature code (DE 8/5)");
          }
          return code;
        })(),
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => {
          const providedDocs: unknown[] = options.omitAdditionalDocuments
            ? []
            : Array.isArray(item.additionalDocuments)
              ? item.additionalDocuments
              : Array.isArray(item.additionalDocument)
                ? item.additionalDocument
                : item.additionalDocument
                  ? [item.additionalDocument]
                  : [];
          const forbiddenSet = new Set(
            (options.forbiddenDocCodes || []).map((c) => c.trim().toUpperCase()),
          );
          const mappedDocs = providedDocs
            .map((doc) => {
              const source = typeof doc === "object" && doc !== null ? doc as Record<string, unknown> : {};
              const mapped: Record<string, string> = {
                CategoryCode: String(source.CategoryCode || source.categoryCode || source.category || "").trim(),
                TypeCode: String(source.TypeCode || source.typeCode || source.type || "").trim(),
                ID: String(source.ID || source.id || source.reference || "").trim(),
              };
              const statusCode = String(source.StatusCode || source.statusCode || "AC").trim();
              if (statusCode) mapped.StatusCode = statusCode;
              return mapped;
            })
            .filter((doc) => doc.CategoryCode && doc.TypeCode && doc.ID)
            .filter((doc) => !forbiddenSet.has(`${doc.CategoryCode}${doc.TypeCode}`.toUpperCase()));

          const procRaw = String(item.procedureCode || "").replace(/\s+/g, '');
          return {
            // CDS expects contiguous 1..n in declaration order; ignore stale DB sequenceNumber.
            SequenceNumeric: index + 1,
            ...(isSelfRepresentation
              ? {
                  AdditionalInformation: [
                    {
                      // Appendix 4A 00500 — docs/hmrc/specs/cds-api/mirrors/appendix-4a-00500.md
                      StatementCode: "00500",
                      StatementDescription: "Importer",
                    },
                  ],
                }
              : {}),
            ...(mappedDocs.length > 0 ? { AdditionalDocument: mappedDocs } : {}),
            StatisticalValueAmount: {
              // DE 8/6 — statistical value is always sterling regardless of invoice currency.
              currencyID: "GBP",
              value: formatAmount(item.valueAmount),
            },
            Commodity: {
              Description: item.description || "",
              Classification: commodityClassifications(item.commodityCode || item.hsCode),
              DutyTaxFee: [
                {
                  DutyRegimeCode: item.preferenceCode || "100",
                  TypeCode: "A00",
                  ...dutyTaxFeeMethod,
                },
                {
                  TypeCode: "B00",
                  ...dutyTaxFeeMethod,
                },
              ],
              GoodsMeasure: {
                GrossMassMeasure: formatMass(item.grossWeightKg),
                NetNetWeightMeasure: clampNetToGross(item.netWeightKg ?? item.grossWeightKg, item.grossWeightKg),
                ...((): Record<string, string> => {
                  const qty = formatSupplementaryQty(item.supplementaryUnitQty);
                  if (!qty) return {};
                  const unitCode = String(item.supplementaryUnitCode || SUPPLEMENTARY_UNIT_CODE_PST).trim() || SUPPLEMENTARY_UNIT_CODE_PST;
                  return {
                    TariffQuantity: qty,
                    TariffQuantityUnitCode: unitCode,
                  };
                })(),
              },
              InvoiceLine: {
                ItemChargeAmount: {
                  // DE 4/14 item charge — practice lane uses GBP (matches statistical value UI).
                  currencyID: "GBP",
                  value: formatAmount(item.valueAmount),
                },
              }
            },
            // DE 4/16 — Customs valuation method. "1" = transaction value of the imported goods.
            CustomsValuation: {
              MethodCode: "1",
            },
            Packaging: [
              {
                SequenceNumeric: "1",
                // DE 6/11 — empty element rejected by local preflight + XSD; "N/A" matches lane evidence.
                MarksNumbersID: String(item.shippingMarks || "").trim() || "N/A",
                QuantityQuantity: item.packageCount || "",
                TypeCode: item.packageType || ""
              }
            ],
            // DE 5/15 Country of Origin — always mandatory (HMRC Group 5 verbatim:
            // "This data element is always mandatory.").
            // Source: docs/hmrc/specs/cds-api/mirrors/group-5-completion-guide.md.
            // Prior conditional omit-when-origin=dispatch logic was uncited inference
            // and contradicted Group 5; DMSREJ 2026-05-27 20:32 confirmed CDS12073
            // fires at 67A/103 + 68A/103 WITH Origin omitted, so omission did not help.
            ...((() => {
              const origin = normalizeCountryCode(item.originCountry);
              if (!origin) return {};
              return {
                Origin: {
                  CountryCode: origin,
                  TypeCode: "1",
                },
              };
            })()),
            ...((() => {
              const additionCode = resolveValuationAdditionCode(declaration);
              return additionCode ? { ValuationAdjustment: { AdditionCode: additionCode } } : {};
            })()),
            GovernmentProcedure: [
              ...(/^\d{4}$/.test(procRaw)
                ? [{
                    // DE 1/10: Requested and Previous Procedure (e.g., 40 00).
                    // No fallback — validateCdsFields rejects missing/malformed CPCs.
                    CurrentCode: procRaw.substring(0, 2),
                    PreviousCode: procRaw.substring(2, 4),
                  }]
                : []),
              ...((() => {
                const apc = String(item.additionalProcedureCode || "").trim();
                // DE 1/11 additional procedure code. Include "000" explicitly — HMRC CDS
                // requires it to declare nil additional procedure for CPC 4000.
                // Omitting "000" introduces CDS11004 (procedure codes incomplete).
                if (apc) return [{ CurrentCode: apc }];
                // No additionalProcedureCode set at all — use "000" for CPC 4000 (nil).
                return [{ CurrentCode: "000" }];
              })())
            ]
          };
        })
      }
    }
  };
}
