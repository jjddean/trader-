/**
 * DE mapping for the I1 C&F simplified import declaration category.
 *
 * Obligation source: `docs/hmrc/specs/cds-api/appendix-21f-i1-obligations.md`
 * (GOV.UK Appendix 21F).
 * WCO element paths: `convex/lib/cds_wco_references.ts`.
 * Element ordering: `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`.
 *
 * I1 is the reduced-form import declaration. Unlike B1/C1 it introduces no new
 * data elements — every I1 row also exists on H1 — but it drops fourteen and
 * re-weights ten, so it is NOT "H1 with fields hidden" either:
 *
 *   dropped   3/24, 3/25 (Seller), 3/26, 3/27 (Buyer), 3/40, 4/6, 4/7, 4/13,
 *             4/15 (exchange rate), 7/5, 7/9 (arrival transport), 7/15,
 *             8/5 (transaction nature), 8/6 (statistical value)
 *   now A     2/3 documents, 3/39 holder of the authorisation
 *   now D     1/9, 4/16, 4/17, 5/8, 5/14, 6/1, 6/14, 6/15
 *
 * The four the H1 mapper emits unconditionally — ArrivalTransportMeans,
 * TransactionNatureCode, StatisticalValueAmount, CurrencyExchange — are exactly
 * the ones that must never appear here.
 */

import {
  clampNetToGross,
  commodityClassifications,
  formatAmount,
  formatMass,
  formatSupplementaryQty,
  mapDeclarationType,
  normalizeCountryCode,
  stripTransportId,
} from "./wco-mapper";
import { resolveGoodsLocationForXml } from "./goods-location";
import { buildDefermentAdditionalDocument, resolveDeclarationPayment, validatePaymentFields } from "./payment-method";

export interface I1MapOptions {
  /** Skip DE 2/3 emission — used by the dry-run preflight. */
  omitAdditionalDocuments?: boolean;
  /** DE 2/3 codes the rule engine has forbidden for this declaration. */
  forbiddenDocCodes?: string[];
}

/**
 * Declaration fields carried by the H1 full import data set that have no row in
 * Appendix 21F. Emitting them on an I1 declares data the category does not hold.
 */
export const H1_ONLY_FIELDS = [
  "transactionNatureCode",
  "exchangeRate",
  "inlandTransportMode",
  "sellerName",
  "sellerEori",
  "buyerName",
  "buyerEori",
] as const;

/**
 * DE 1/2 codes valid for the I1 C&F simplified declaration (regular use).
 * C and F are the SDP/EIDR regular-use codes; anything else belongs on H1.
 */
export const I1_ADDITIONAL_DECLARATION_TYPES = ["C", "F"] as const;

function trimmed(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Mandatory-element validation for I1, per the Appendix 21F A-rows.
 * Returns human-readable errors; empty array means the payload can be built.
 */
export function validateI1Declaration(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  const errors: string[] = [];

  // See the note in b1-mapper.ts — `route` may carry HMRC's document-check
  // route rather than a trade direction, so only a contradicting value fails.
  if (trimmed(declaration.route).toLowerCase() === "export") {
    errors.push('Declaration route is "export" but I1 is an import data set');
  }
  const category = trimmed(declaration.declarationCategory).toUpperCase();
  if (category && category !== "I1") {
    errors.push(`Declaration category ${category} routed to the I1 mapper`);
  }

  // DE 1/2 — additional declaration type. I1 C&F is the regular-use simplified
  // declaration: only C and F select this data set.
  // DE 1/2 lives in `additionalDeclarationType`; `declarationType` is the category.
  const declType = trimmed(declaration.additionalDeclarationType).toUpperCase();
  if (!declType) {
    errors.push("Missing additional declaration type (DE 1/2)");
  } else if (!I1_ADDITIONAL_DECLARATION_TYPES.includes(declType as "C" | "F")) {
    errors.push(
      `Additional declaration type ${declType} is not valid for I1 C&F (DE 1/2 must be C or F) — use the H1 full data set`,
    );
  }

  // DE 3/18 — declarant EORI.
  if (!trimmed(declaration.eori)) {
    errors.push("Missing declarant EORI (DE 3/18)");
  }
  // DE 3/39 — holder of the authorisation. Mandatory on I1 (D on H1): the SDP
  // or EIDR authorisation is what permits the reduced form at all.
  if (!trimmed(declaration.authorisationHolderEori)) {
    errors.push("Missing holder of the authorisation (DE 3/39) — required for a simplified declaration");
  }
  // DE 5/23 — goods location.
  if (!trimmed(declaration.locationId)) {
    errors.push("Missing goods location (DE 5/23)");
  }
  // DE 7/4 — mode of transport at the border.
  if (!trimmed(declaration.transportMode)) {
    errors.push("Missing mode of transport at the border (DE 7/4)");
  }

  const present = H1_ONLY_FIELDS.filter((f) => trimmed(declaration[f]));
  if (present.length > 0) {
    errors.push(
      `Data elements not present on the I1 data set: ${present.join(", ")} — these require the H1 full declaration`,
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("An I1 declaration must carry at least one goods item (DE 1/6)");
    return errors;
  }

  items.forEach((item, index) => {
    const n = index + 1;
    // DE 1/10 — procedure code.
    if (!trimmed(item.procedureCode)) errors.push(`Item ${n}: missing procedure code (DE 1/10)`);
    // DE 1/11 — additional procedure code.
    if (!trimmed(item.additionalProcedureCode)) {
      errors.push(`Item ${n}: missing additional procedure code (DE 1/11)`);
    }
    // DE 2/3 — documents. Mandatory on I1 (conditional on H1): a reduced-form
    // import is not a document-less import.
    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    if (docs.length === 0) {
      errors.push(`Item ${n}: missing documents, certificates and authorisations (DE 2/3)`);
    }
    // DE 6/8 — description of goods.
    if (!trimmed(item.description)) errors.push(`Item ${n}: missing goods description (DE 6/8)`);
    // DE 6/5 — gross mass.
    const gross = parseFloat(String(item.grossWeightKg ?? ""));
    if (!isFinite(gross) || gross <= 0) errors.push(`Item ${n}: missing gross mass (DE 6/5)`);
    // DE 6/9 — package type.
    if (!trimmed(item.packageType)) errors.push(`Item ${n}: missing package type (DE 6/9)`);
    // DE 6/10 — number of packages.
    const pkgs = parseInt(String(item.packageCount ?? ""), 10);
    if (!isFinite(pkgs) || pkgs <= 0) errors.push(`Item ${n}: missing number of packages (DE 6/10)`);
    // DE 6/11 — shipping marks. Mandatory on I1.
    if (!trimmed(item.shippingMarks)) errors.push(`Item ${n}: missing shipping marks (DE 6/11)`);
  });

  return errors;
}

export function mapToCDS_I1(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
  options: I1MapOptions = {},
) {
  const errors = validateI1Declaration(declaration, items);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const paymentError = validatePaymentFields(
    declaration.paymentMethodCode,
    declaration.defermentAccountNumber,
  );
  if (paymentError) {
    throw new Error(paymentError);
  }
  const { dan, mop } = resolveDeclarationPayment(declaration);
  const headerDefermentDocs = dan ? [buildDefermentAdditionalDocument(dan)] : [];

  const forbiddenSet = new Set(
    (options.forbiddenDocCodes || []).map((c) => String(c).toUpperCase()),
  );
  const declarantEori = trimmed(declaration.eori).toUpperCase();
  const lrn = trimmed(declaration.lrn) || `FC-${Date.now().toString(36).toUpperCase()}`;
  const ducr =
    trimmed(declaration.ducr)
    || `${new Date().getFullYear() % 10}GB${declarantEori.replace(/^GB/i, "")}-${trimmed(declaration._id).substring(0, 6).toUpperCase() || "I1IMPT"}`;
  const currency = trimmed(declaration.invoiceCurrency);

  const totalGrossWeight = items.reduce(
    (acc, item) => acc + (parseFloat(String(item.grossWeightKg ?? "")) || 0),
    0,
  );

  const declaredRepType = trimmed(declaration.representationType) || "self";
  const importerEori = declaredRepType === "self"
    ? trimmed(declaration.importerEori) || declarantEori
    : trimmed(declaration.importerEori);

  return {
    Declaration: {
      FunctionCode: "9",
      // DE 1/1 + 1/2 — IM prefix with the C&F simplified type letter.
      TypeCode: mapDeclarationType(trimmed(declaration.additionalDeclarationType), "import"),
      FunctionalReferenceID: lrn,
      GoodsItemQuantity: items.length,
      DeclarationOfficeID: trimmed(declaration.presentationOffice),
      InvoiceAmount: {
        currencyID: currency,
        value: formatAmount(declaration.invoiceTotal),
      },
      TotalGrossMassMeasure: formatMass(declaration.totalGrossWeight || totalGrossWeight),
      TotalPackageQuantity: items.reduce(
        (acc, item) => acc + (parseInt(String(item.packageCount ?? ""), 10) || 0),
        0,
      ),
      // DE 4/15 exchange rate is not on the I1 data set — no CurrencyExchange.
      ...(headerDefermentDocs.length > 0 ? { AdditionalDocument: headerDefermentDocs } : {}),
      // DE 3/39 — mandatory on I1.
      AuthorisationHolder: {
        ID: trimmed(declaration.authorisationHolderEori).toUpperCase(),
        ...(trimmed(declaration.authorisationCategoryCode)
          ? { CategoryCode: trimmed(declaration.authorisationCategoryCode) }
          : {}),
      },
      // DE 7/4 — border transport. DE 7/9 arrival identity and DE 7/15
      // nationality are not on I1, so this block carries mode only alongside
      // whatever identity the trader holds.
      BorderTransportMeans: {
        ...(stripTransportId(declaration.transportId)
          ? {
              ID: stripTransportId(declaration.transportId),
              IdentificationTypeCode: trimmed(declaration.transportIdType),
            }
          : {}),
        ModeCode: trimmed(declaration.transportMode),
      },
      Declarant: { ID: declarantEori },
      // DE 3/1 + 3/2 — Exporter, conditional on I1.
      ...(trimmed(declaration.exporterEori)
        ? { Exporter: { ID: trimmed(declaration.exporterEori).toUpperCase() } }
        : trimmed(declaration.exporterName) && trimmed(declaration.exporterCity)
          && trimmed(declaration.exporterLine) && trimmed(declaration.exporterPostcode)
          ? {
              Exporter: {
                Name: trimmed(declaration.exporterName),
                Address: {
                  CityName: trimmed(declaration.exporterCity),
                  CountryCode: normalizeCountryCode(declaration.dispatchCountry),
                  Line: trimmed(declaration.exporterLine),
                  PostcodeID: trimmed(declaration.exporterPostcode),
                },
              },
            }
          : {}),
      UCR: { TraderAssignedReferenceID: ducr },
      GoodsShipment: {
        // DE 8/5 TransactionNatureCode is not on the I1 data set.
        Consignment: {
          // DE 7/2 — container indicator, mandatory on I1.
          ContainerCode: trimmed(declaration.containerNumber) ? "1" : "0",
          // DE 7/9 ArrivalTransportMeans is not on the I1 data set.
          GoodsLocation: resolveGoodsLocationForXml(declaration),
        },
        // DE 5/8 and DE 5/14 are conditional on I1 — emit only when declared.
        ...(normalizeCountryCode(declaration.destinationCountry)
          ? { Destination: { CountryCode: normalizeCountryCode(declaration.destinationCountry) } }
          : {}),
        ...(normalizeCountryCode(declaration.dispatchCountry)
          ? { ExportCountry: { ID: normalizeCountryCode(declaration.dispatchCountry) } }
          : {}),
        ...(importerEori ? { Importer: { ID: importerEori } } : {}),
        // DE 2/1 — previous documents. DUCR anchors the pointer chain.
        PreviousDocument: [
          { CategoryCode: "Z", TypeCode: "DCR", ID: ducr, LineNumeric: "1" },
        ],
        // DE 4/1 — delivery terms, conditional on I1.
        ...(trimmed(declaration.incoterms)
          ? { TradeTerms: { ConditionCode: trimmed(declaration.incoterms) } }
          : {}),
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
            .filter(
              (doc) => !forbiddenSet.has(`${doc.CategoryCode}${doc.TypeCode}`.toUpperCase()),
            );

          const supplementaryQty = formatSupplementaryQty(item.supplementaryUnitQty);

          return {
            SequenceNumeric: index + 1,
            // DE 8/6 StatisticalValueAmount is not on the I1 data set.
            ...(additionalDocuments.length > 0
              ? { AdditionalDocument: additionalDocuments }
              : {}),
            Commodity: {
              Description: trimmed(item.description),
              // DE 6/14 + 6/15 are conditional on I1.
              ...(trimmed(item.commodityCode)
                ? { Classification: commodityClassifications(item.commodityCode) }
                : {}),
              GoodsMeasure: {
                GrossMassMeasure: formatMass(item.grossWeightKg),
                // DE 6/1 net mass is conditional on I1 — emit only when declared.
                ...(parseFloat(String(item.netWeightKg ?? "")) > 0
                  ? { NetNetWeightMeasure: clampNetToGross(item.netWeightKg, item.grossWeightKg) }
                  : {}),
                ...(supplementaryQty
                  ? {
                      TariffQuantity: supplementaryQty,
                      TariffQuantityUnitCode: trimmed(item.supplementaryUnitCode) || "NAR",
                    }
                  : {}),
              },
              ...(mop ? { DutyTaxFee: [{ TypeCode: "A00", MethodCode: mop }] } : {}),
            },
            // DE 1/10 requested + previous procedure, then DE 1/11.
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
            // DE 5/15 — country of origin, conditional.
            ...(normalizeCountryCode(item.originCountry)
              ? { Origin: { CountryCode: normalizeCountryCode(item.originCountry), TypeCode: "1" } }
              : {}),
            Packaging: [
              {
                SequenceNumeric: "1",
                // DE 6/11 — shipping marks, mandatory on I1.
                MarksNumbersID: trimmed(item.shippingMarks),
                QuantityQuantity: String(parseInt(String(item.packageCount ?? ""), 10) || 0),
                // DE 6/9 — package type, mandatory on I1.
                TypeCode: trimmed(item.packageType),
              },
            ],
          };
        }),
      },
    },
  };
}
