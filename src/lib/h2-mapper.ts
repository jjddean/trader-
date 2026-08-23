/**
 * DE mapping for the H2 customs warehousing declaration category.
 *
 * Obligation source: `docs/hmrc/specs/cds-api/appendix-21b-h2-obligations.md`
 * Procedure rules:   `docs/hmrc/customs-warehousing/declarations/procedure-71.md`
 * Structured rules:  `docs/hmrc/customs-warehousing/validation/h2-rules.json`
 * Code sets:         `docs/hmrc/customs-warehousing/reference/warehouse-types.json`
 *
 * H2 places goods INTO a customs warehouse with duty and import VAT suspended.
 * Because no charge arises at entry, Group 4 is almost entirely absent — no
 * valuation method, delivery terms, tax calculation, method of payment,
 * deferred payment, additions and deductions or invoice totals. Reusing the H1
 * mapper unchanged would emit every one of them.
 *
 * Three data elements form one logical object and must agree:
 *
 *   DE 2/7   warehouse type + identifier      U + 1234567GB
 *   DE 3/39  authorisation type + holder EORI CWP + GB553202734852
 *   DE 2/3   document code + decision number  C517 + the authorisation number
 *
 * Mapping: U↔CWP↔C517, R↔CW1↔C518, S↔CW2↔C519.
 */

import {
  commodityClassifications,
  formatAmount,
  formatMass,
  formatSupplementaryQty,
  normalizeCountryCode,
} from "./wco-mapper";
import { resolveGoodsLocationForXml } from "./goods-location";

export interface H2MapOptions {
  /** Skip DE 2/3 emission — used by the dry-run preflight. */
  omitAdditionalDocuments?: boolean;
  /** DE 2/3 codes the rule engine has forbidden for this declaration. */
  forbiddenDocCodes?: string[];
}

/** DE 2/7 warehouse types valid on procedure 71. Y and Z are not. */
export const H2_WAREHOUSE_TYPES = ["R", "S", "T", "U"] as const;

/** Types barred from a GB or XI warehouse identifier (procedure 71). */
export const H2_TYPES_BARRED_FROM_GB_XI = new Set(["S", "T"]);

/** DE 2/7 type → DE 3/39 authorisation type → DE 2/3 document code. */
export const H2_WAREHOUSE_AUTHORISATION_MAP: Record<
  string,
  { authorisationTypeCode: string; documentCode: string; meaning: string }
> = {
  U: { authorisationTypeCode: "CWP", documentCode: "C517", meaning: "Private customs warehouse" },
  R: { authorisationTypeCode: "CW1", documentCode: "C518", meaning: "Public customs warehouse type 1" },
  S: { authorisationTypeCode: "CW2", documentCode: "C519", meaning: "Public customs warehouse type 2" },
  // Type T (public type 3) has no authorisation code published on procedure 71.
};

/** The ten entry codes. Only one 4-digit code per goods item. */
export const H2_PROCEDURE_CODES = [
  "7100", "7110", "7121", "7122", "7123", "7151", "7153", "7154", "7171", "7178",
] as const;

/** DE 1/2 codes permitted on procedure 71. Y and Z are excluded deliberately. */
export const H2_ADDITIONAL_DECLARATION_TYPES = ["A", "C", "D", "F", "J", "K"] as const;

/** DE 1/11 for 7100. Other codes carry their own lists — see the mirror. */
export const H2_APC_7100 = ["F15", "000", "1VW", "2CD", "2CG"] as const;

/**
 * Declaration fields that belong to the H1 valuation block and have no row on
 * the H2 data set. No charge arises at entry, so declaring any of them is an
 * error rather than surplus detail.
 */
export const NOT_ON_H2_FIELDS = [
  "incoterms",
  "incotermLocation",
  "paymentMethodCode",
  "defermentAccountNumber",
  "valuationMethod",
  "invoiceTotal",
  "guaranteeType",
  "guaranteeReference",
] as const;

function trimmed(value: unknown): string {
  return String(value ?? "").trim();
}

/** The trailing country code of a DE 2/7 warehouse identifier, e.g. `GB`. */
export function warehouseIdentifierCountry(identifier: unknown): string {
  const raw = trimmed(identifier).toUpperCase();
  const m = raw.match(/([A-Z]{2})$/);
  return m ? m[1] : "";
}

/**
 * Mandatory-element validation for H2, per the Appendix 21B A-rows and the
 * procedure 71 completion rules.
 */
export function validateH2Declaration(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  const errors: string[] = [];

  const routeValue = trimmed(declaration.route).toLowerCase();
  if (routeValue === "export") {
    errors.push('Declaration route is "export" but H2 is an import data set');
  }
  const category = trimmed(declaration.declarationCategory).toUpperCase();
  if (category && category !== "H2") {
    errors.push(`Declaration category ${category} routed to the H2 mapper`);
  }

  // DE 1/1 — IM, or CO for Customs Union status.
  const declType = trimmed(declaration.declarationType).toUpperCase();
  if (declType && !["IM", "CO"].includes(declType)) {
    errors.push(`Declaration type ${declType} is not valid for H2 (DE 1/1 must be IM or CO)`);
  }

  // DE 1/2 — the supplementary types Y and Z are waived on entry.
  const addlType = trimmed(declaration.additionalDeclarationType).toUpperCase();
  if (addlType) {
    if (["Y", "Z"].includes(addlType)) {
      errors.push(
        `Additional declaration type ${addlType} is a supplementary declaration. The supplementary obligation is waived on entry to customs warehousing (UCC Article 167(2)(a)), so it must not be used.`,
      );
    } else if (!(H2_ADDITIONAL_DECLARATION_TYPES as readonly string[]).includes(addlType)) {
      errors.push(`Additional declaration type ${addlType} is not valid for procedure 71 (DE 1/2 must be A, C, D, F, J or K)`);
    }
  }

  // DE 3/18 — declarant EORI.
  if (!trimmed(declaration.eori)) {
    errors.push("Missing declarant EORI (DE 3/18)");
  }

  // DE 2/7 — the element unique to this category.
  const whType = trimmed(declaration.warehouseTypeCode).toUpperCase();
  const whId = trimmed(declaration.warehouseIdentifier);
  if (!whType || !whId) {
    errors.push("Missing identification of warehouse (DE 2/7) — both the type and the identifier are required");
  } else {
    if (!(H2_WAREHOUSE_TYPES as readonly string[]).includes(whType)) {
      errors.push(
        `Warehouse type ${whType} is not valid on procedure 71 (DE 2/7 must be R, S, T or U — Y and Z are not customs warehouses)`,
      );
    }
    const country = warehouseIdentifierCountry(whId);
    if (H2_TYPES_BARRED_FROM_GB_XI.has(whType) && ["GB", "XI"].includes(country)) {
      errors.push(`Warehouse type ${whType} may not be used with a ${country} warehouse identifier (DE 2/7)`);
    }
  }

  // DE 3/39 — mandatory on H2, conditional on H1.
  const authHolder = trimmed(declaration.authorisationHolderEori);
  const authType = trimmed(declaration.authorisationCategoryCode).toUpperCase();
  if (!authHolder) {
    errors.push("Missing holder of the authorisation (DE 3/39) — mandatory on H2");
  }
  if (authType === "CW2") {
    const country = warehouseIdentifierCountry(whId);
    if (["GB", "XI"].includes(country)) {
      errors.push("Authorisation type CW2 cannot be used with GB or XI");
    }
  }
  // Cross-check inferred from the one-to-one code sets; HMRC does not state it
  // explicitly, so it reads as a mismatch rather than a hard schema error.
  const expected = H2_WAREHOUSE_AUTHORISATION_MAP[whType];
  if (expected && authType && authType !== expected.authorisationTypeCode) {
    errors.push(
      `Warehouse type ${whType} (${expected.meaning}) expects authorisation type ${expected.authorisationTypeCode}, not ${authType}`,
    );
  }

  // DE 5/23 — goods location.
  if (!trimmed(declaration.locationId)) {
    errors.push("Missing goods location (DE 5/23)");
  }
  // DE 5/8 and DE 5/14 are both A on H2.
  if (!normalizeCountryCode(declaration.destinationCountry)) {
    errors.push("Missing country of destination (DE 5/8)");
  }
  if (!normalizeCountryCode(declaration.dispatchCountry)) {
    errors.push("Missing country of dispatch/export (DE 5/14)");
  }
  // DE 7/4 and DE 8/5.
  if (!trimmed(declaration.transportMode)) {
    errors.push("Missing mode of transport at the border (DE 7/4)");
  }
  if (!trimmed(declaration.transactionNatureCode)) {
    errors.push("Missing transaction nature code (DE 8/5)");
  }

  const present = NOT_ON_H2_FIELDS.filter((f) => trimmed(declaration[f]));
  if (present.length > 0) {
    errors.push(
      `Data elements not present on the H2 data set: ${present.join(", ")} — no charge arises at entry to a customs warehouse, so the valuation and guarantee blocks are not declared`,
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("An H2 declaration must carry at least one goods item (DE 1/6)");
    return errors;
  }

  items.forEach((item, index) => {
    const n = index + 1;
    const proc = trimmed(item.procedureCode);
    // DE 1/10 — every item must be a 71-series code.
    if (!proc) {
      errors.push(`Item ${n}: missing procedure code (DE 1/10)`);
    } else if (!proc.startsWith("71")) {
      errors.push(`Item ${n}: procedure code ${proc} is not a customs warehousing entry — DE 1/10 must begin 71 on an H2`);
    } else if (!(H2_PROCEDURE_CODES as readonly string[]).includes(proc)) {
      errors.push(`Item ${n}: ${proc} is not a published 71-series procedure code`);
    }
    // DE 1/11.
    const apc = trimmed(item.additionalProcedureCode);
    if (!apc) {
      errors.push(`Item ${n}: missing additional procedure code (DE 1/11)`);
    } else if (proc === "7100" && !(H2_APC_7100 as readonly string[]).includes(apc.toUpperCase())) {
      errors.push(`Item ${n}: additional procedure code ${apc} is not valid with 7100 (expected F15, 000, 1VW, 2CD or 2CG)`);
    }
    // DE 2/3 — A on H2, D on H1.
    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    if (docs.length === 0) {
      errors.push(`Item ${n}: missing documents, certificates and authorisations (DE 2/3)`);
    }
    // DE 6/8, 6/14, 6/5, and the three packaging elements that are A on H2.
    if (!trimmed(item.description)) errors.push(`Item ${n}: missing goods description (DE 6/8)`);
    if (!trimmed(item.commodityCode)) errors.push(`Item ${n}: missing commodity code (DE 6/14)`);
    const gross = parseFloat(String(item.grossWeightKg ?? ""));
    if (!isFinite(gross) || gross <= 0) errors.push(`Item ${n}: missing gross mass (DE 6/5)`);
    if (!trimmed(item.packageType)) errors.push(`Item ${n}: missing package type (DE 6/9)`);
    const pkgs = parseInt(String(item.packageCount ?? ""), 10);
    if (!isFinite(pkgs) || pkgs <= 0) errors.push(`Item ${n}: missing number of packages (DE 6/10)`);
    if (!trimmed(item.shippingMarks)) errors.push(`Item ${n}: missing shipping marks (DE 6/11)`);
    // DE 8/6 — A at item level on H2.
    const statValue = item.statisticalValue ?? item.valueAmount;
    const sv = parseFloat(String(statValue ?? ""));
    if (!isFinite(sv) || sv <= 0) errors.push(`Item ${n}: missing statistical value (DE 8/6)`);
  });

  // DE 1/1 CO requires APC F15 somewhere on the declaration.
  if (declType === "CO") {
    const hasF15 = items.some((i) => trimmed(i.additionalProcedureCode).toUpperCase() === "F15");
    if (!hasF15) {
      errors.push("Declaration type CO (Customs Union status) requires additional procedure code F15 in DE 1/11");
    }
  }

  return errors;
}

export function mapToCDS_H2(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
  options: H2MapOptions = {},
) {
  const errors = validateH2Declaration(declaration, items);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const forbiddenSet = new Set(
    (options.forbiddenDocCodes || []).map((c) => String(c).toUpperCase()),
  );
  const declarantEori = trimmed(declaration.eori).toUpperCase();
  const lrn = trimmed(declaration.lrn) || `FC-${Date.now().toString(36).toUpperCase()}`;
  const ducr =
    trimmed(declaration.ducr)
    || `${new Date().getFullYear() % 10}GB${declarantEori.replace(/^GB/i, "")}-${trimmed(declaration._id).substring(0, 6).toUpperCase() || "H2WHSE"}`;
  const currency = trimmed(declaration.invoiceCurrency) || "GBP";

  const totalGrossWeight = items.reduce(
    (acc, item) => acc + (parseFloat(String(item.grossWeightKg ?? "")) || 0),
    0,
  );

  const whType = trimmed(declaration.warehouseTypeCode).toUpperCase();
  const whId = trimmed(declaration.warehouseIdentifier);
  const authType = trimmed(declaration.authorisationCategoryCode).toUpperCase()
    || H2_WAREHOUSE_AUTHORISATION_MAP[whType]?.authorisationTypeCode
    || "";

  return {
    Declaration: {
      FunctionCode: "9",
      // DE 1/1 + 1/2. Import family; the CO variant carries Customs Union status.
      TypeCode: `${trimmed(declaration.declarationType).toUpperCase() || "IM"}${trimmed(declaration.additionalDeclarationType).toUpperCase() || "A"}`,
      FunctionalReferenceID: lrn,
      GoodsItemQuantity: items.length,
      DeclarationOfficeID: trimmed(declaration.presentationOffice),
      InvoiceAmount: { currencyID: currency, value: formatAmount(0) },
      TotalGrossMassMeasure: formatMass(declaration.totalGrossWeight || totalGrossWeight),
      TotalPackageQuantity: items.reduce(
        (acc, item) => acc + (parseInt(String(item.packageCount ?? ""), 10) || 0),
        0,
      ),
      // DE 3/39 — mandatory. Paired with the DE 2/3 document code below.
      AuthorisationHolder: {
        ID: trimmed(declaration.authorisationHolderEori).toUpperCase(),
        ...(authType ? { CategoryCode: authType } : {}),
      },
      BorderTransportMeans: {
        ...(trimmed(declaration.transportId)
          ? {
              ID: trimmed(declaration.transportId).replace(/\s+/g, ""),
              IdentificationTypeCode: trimmed(declaration.transportIdType),
            }
          : {}),
        ModeCode: trimmed(declaration.transportMode),
      },
      Declarant: { ID: declarantEori },
      // DE 5/27 — optional on GB declarations.
      ...(trimmed(declaration.supervisingCustomsOffice)
        ? { SupervisingOffice: { ID: trimmed(declaration.supervisingCustomsOffice).toUpperCase() } }
        : {}),
      UCR: { TraderAssignedReferenceID: ducr },
      GoodsShipment: {
        // DE 8/5 — A on H2.
        TransactionNatureCode: trimmed(declaration.transactionNatureCode),
        Consignment: {
          // DE 7/2 — A on H2.
          ContainerCode: trimmed(declaration.containerNumber) ? "1" : "0",
          GoodsLocation: resolveGoodsLocationForXml(declaration),
        },
        Destination: { CountryCode: normalizeCountryCode(declaration.destinationCountry) },
        ExportCountry: { ID: normalizeCountryCode(declaration.dispatchCountry) },
        ...(trimmed(declaration.importerEori)
          ? { Importer: { ID: trimmed(declaration.importerEori).toUpperCase() } }
          : {}),
        // DE 2/7 — identification of warehouse. Header level: every item on the
        // declaration must be entered to the same warehouse.
        Warehouse: { ID: whId.toUpperCase(), TypeCode: whType },
        // DE 2/1 — DUCR anchors the pointer chain.
        PreviousDocument: [
          { CategoryCode: "Z", TypeCode: "DCR", ID: ducr, LineNumeric: "1" },
        ],
        // No TradeTerms, CustomsValuation, DutyTaxFee or InvoiceLine: no charge
        // arises at entry, so Group 4 is not declared.
        GovernmentAgencyGoodsItem: items.map((item, index) => {
          const providedDocs: unknown[] = options.omitAdditionalDocuments
            ? []
            : Array.isArray(item.additionalDocuments)
              ? item.additionalDocuments
              : [];
          const additionalDocuments = providedDocs
            .map((raw) => {
              const source = (raw ?? {}) as Record<string, unknown>;
              return {
                CategoryCode: trimmed(source.CategoryCode ?? source.categoryCode),
                TypeCode: trimmed(source.TypeCode ?? source.typeCode),
                ID: trimmed(source.ID ?? source.id),
                StatusCode: trimmed(source.StatusCode ?? source.statusCode),
              };
            })
            .filter((doc) => doc.CategoryCode && doc.TypeCode && doc.ID)
            .filter((doc) => !forbiddenSet.has(`${doc.CategoryCode}${doc.TypeCode}`.toUpperCase()));

          const supplementaryQty = formatSupplementaryQty(item.supplementaryUnitQty);

          return {
            SequenceNumeric: index + 1,
            // DE 8/6 — A at item level.
            StatisticalValueAmount: {
              currencyID: "GBP",
              value: formatAmount(item.statisticalValue ?? item.valueAmount),
            },
            ...(additionalDocuments.length > 0 ? { AdditionalDocument: additionalDocuments } : {}),
            Commodity: {
              Description: trimmed(item.description),
              Classification: commodityClassifications(item.commodityCode),
              GoodsMeasure: {
                // DE 6/5 only. Net mass is not on the H2 data set.
                GrossMassMeasure: formatMass(item.grossWeightKg),
                ...(supplementaryQty
                  ? {
                      TariffQuantity: supplementaryQty,
                      TariffQuantityUnitCode: trimmed(item.supplementaryUnitCode) || "NAR",
                    }
                  : {}),
              },
            },
            GovernmentProcedure: (() => {
              const proc = trimmed(item.procedureCode);
              const apc = trimmed(item.additionalProcedureCode);
              return [
                ...(/^\d{4}$/.test(proc)
                  ? [{ CurrentCode: proc.substring(0, 2), PreviousCode: proc.substring(2, 4) }]
                  : []),
                ...(apc ? [{ CurrentCode: apc }] : []),
              ];
            })(),
            ...(normalizeCountryCode(item.originCountry)
              ? { Origin: { CountryCode: normalizeCountryCode(item.originCountry), TypeCode: "1" } }
              : {}),
            Packaging: [
              {
                SequenceNumeric: "1",
                MarksNumbersID: trimmed(item.shippingMarks),
                QuantityQuantity: String(parseInt(String(item.packageCount ?? ""), 10) || 0),
                TypeCode: trimmed(item.packageType),
              },
            ],
          };
        }),
      },
    },
  };
}
