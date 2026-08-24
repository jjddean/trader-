/**
 * DE mapping for the C1 C&F simplified export declaration category.
 *
 * Obligation source: `docs/hmrc/specs/cds-api/appendix-22d-c1-obligations.md`
 * (GOV.UK Appendix 22D).
 * WCO element paths: `convex/lib/cds_wco_references.ts`.
 * Element ordering: `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`.
 *
 * C1 is the reduced-form export declaration — B1's export shape, minus eleven
 * elements, plus two that become mandatory:
 *
 *   dropped   4/11, 4/15, 5/14, 6/5 (gross mass), 6/18 (total packages),
 *             7/5, 7/7, 7/14, 7/15, 8/5 (transaction nature),
 *             8/6 (statistical value)
 *   now A     2/3 documents, 3/39 holder of the authorisation,
 *             6/9, 6/11, 7/2
 *   now D     6/14 commodity code
 *
 * DE 1/2 must be C or F — the SDP/EIDR regular-use codes. A scenario requiring
 * the full data set must go to B1, never be silently reduced.
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
import { buildB1ConsigneeBlock, buildB1ExporterBlock } from "./b1-mapper";
import { resolveGoodsLocationForXml } from "./goods-location";

export interface C1MapOptions {
  /** Skip DE 2/3 emission — used by the dry-run preflight. */
  omitAdditionalDocuments?: boolean;
  /** DE 2/3 codes the rule engine has forbidden for this declaration. */
  forbiddenDocCodes?: string[];
}

/**
 * Declaration fields that belong to the import data sets, or to the full B1
 * export set, and have no row in Appendix 22D.
 */
export const NOT_ON_C1_FIELDS = [
  // import-only
  "importerEori",
  "incoterms",
  "incotermLocation",
  "defermentAccountNumber",
  "paymentMethodCode",
  "valuationMethod",
  "preferenceCode",
  // B1-only
  "transactionNatureCode",
  "exchangeRate",
  "inlandTransportMode",
  "departureTransportId",
  "borderTransportNationality",
] as const;

/** DE 1/2 codes valid for C1 C&F (regular use). */
export const C1_ADDITIONAL_DECLARATION_TYPES = ["C", "F"] as const;

function trimmed(value: unknown): string {
  return String(value ?? "").trim();
}

/** DE 5/18 — countries of routing, in declared order. */
function buildItinerary(declaration: Record<string, unknown>) {
  const raw = declaration.countriesOfRouting;
  const list = Array.isArray(raw)
    ? raw
    : trimmed(raw)
      ? trimmed(raw).split(/[,\s]+/)
      : [];
  const codes = list.map((c) => normalizeCountryCode(c)).filter(Boolean);
  return codes.map((code, i) => ({ SequenceNumeric: String(i + 1), RoutingCountryCode: code }));
}

/**
 * Mandatory-element validation for C1, per the Appendix 22D A-rows.
 */
export function validateC1Declaration(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  const errors: string[] = [];

  // See the note in b1-mapper.ts — `route` may carry HMRC's document-check
  // route rather than a trade direction, so only a contradicting value fails.
  if (trimmed(declaration.route).toLowerCase() === "import") {
    errors.push('Declaration route is "import" but C1 is an export data set');
  }
  const category = trimmed(declaration.declarationCategory).toUpperCase();
  if (category && category !== "C1") {
    errors.push(`Declaration category ${category} routed to the C1 mapper`);
  }

  // DE 1/2 — only C and F select the simplified export data set.
  // DE 1/2 lives in `additionalDeclarationType`; `declarationType` is the category.
  const declType = trimmed(declaration.additionalDeclarationType).toUpperCase();
  if (!declType) {
    errors.push("Missing additional declaration type (DE 1/2)");
  } else if (!C1_ADDITIONAL_DECLARATION_TYPES.includes(declType as "C" | "F")) {
    errors.push(
      `Additional declaration type ${declType} is not valid for C1 C&F (DE 1/2 must be C or F) — use the B1 full export data set`,
    );
  }

  // DE 3/18 — declarant EORI.
  if (!trimmed(declaration.eori)) {
    errors.push("Missing declarant EORI (DE 3/18)");
  }
  // DE 3/39 — holder of the authorisation. Mandatory on C1.
  if (!trimmed(declaration.authorisationHolderEori)) {
    errors.push("Missing holder of the authorisation (DE 3/39) — required for a simplified declaration");
  }
  // DE 5/8 — country of destination.
  if (!normalizeCountryCode(declaration.destinationCountry)) {
    errors.push("Missing country of destination (DE 5/8)");
  }
  // DE 5/12 — customs office of exit.
  if (!trimmed(declaration.customsOfficeOfExit)) {
    errors.push("Missing customs office of exit (DE 5/12)");
  }
  // DE 5/23 — goods location.
  if (!trimmed(declaration.locationId)) {
    errors.push("Missing goods location (DE 5/23)");
  }
  // DE 7/4 — mode of transport at the border.
  if (!trimmed(declaration.transportMode)) {
    errors.push("Missing mode of transport at the border (DE 7/4)");
  }

  const present = NOT_ON_C1_FIELDS.filter((f) => trimmed(declaration[f]));
  if (present.length > 0) {
    errors.push(
      `Data elements not present on the C1 data set: ${present.join(", ")} — these require the B1 full export declaration`,
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("A C1 declaration must carry at least one goods item (DE 1/6)");
    return errors;
  }

  items.forEach((item, index) => {
    const n = index + 1;
    // DE 1/10 + 1/11.
    if (!trimmed(item.procedureCode)) errors.push(`Item ${n}: missing procedure code (DE 1/10)`);
    if (!trimmed(item.additionalProcedureCode)) {
      errors.push(`Item ${n}: missing additional procedure code (DE 1/11)`);
    }
    // DE 2/3 — mandatory on C1.
    const docs = Array.isArray(item.additionalDocuments) ? item.additionalDocuments : [];
    if (docs.length === 0) {
      errors.push(`Item ${n}: missing documents, certificates and authorisations (DE 2/3)`);
    }
    // DE 6/8, 6/9, 6/10, 6/11 — all mandatory.
    if (!trimmed(item.description)) errors.push(`Item ${n}: missing goods description (DE 6/8)`);
    if (!trimmed(item.packageType)) errors.push(`Item ${n}: missing package type (DE 6/9)`);
    const pkgs = parseInt(String(item.packageCount ?? ""), 10);
    if (!isFinite(pkgs) || pkgs <= 0) errors.push(`Item ${n}: missing number of packages (DE 6/10)`);
    if (!trimmed(item.shippingMarks)) errors.push(`Item ${n}: missing shipping marks (DE 6/11)`);
  });

  return errors;
}

export function mapToCDS_C1(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
  options: C1MapOptions = {},
) {
  const errors = validateC1Declaration(declaration, items);
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
    || `${new Date().getFullYear() % 10}GB${declarantEori.replace(/^GB/i, "")}-${trimmed(declaration._id).substring(0, 6).toUpperCase() || "C1EXPT"}`;
  const currency = trimmed(declaration.invoiceCurrency) || "GBP";

  const itinerary = buildItinerary(declaration);
  const carrierEori = trimmed(declaration.carrierEori);
  const carrierName = trimmed(declaration.carrierName);
  const freightMop = trimmed(declaration.transportChargesMethodOfPayment);
  const containerNumber = trimmed(declaration.containerNumber);
  const sealId = trimmed(declaration.sealNumber);

  return {
    Declaration: {
      FunctionCode: "9",
      // DE 1/1 + 1/2 — EX prefix with the C&F simplified type letter.
      TypeCode: mapDeclarationType(trimmed(declaration.additionalDeclarationType), "export"),
      FunctionalReferenceID: lrn,
      GoodsItemQuantity: items.length,
      DeclarationOfficeID: trimmed(declaration.presentationOffice),
      InvoiceAmount: {
        currencyID: currency,
        value: formatAmount(declaration.invoiceTotal),
      },
      // DE 6/18 total packages is not on the C1 data set.
      // DE 3/39 — mandatory on C1.
      AuthorisationHolder: {
        ID: trimmed(declaration.authorisationHolderEori).toUpperCase(),
        ...(trimmed(declaration.authorisationCategoryCode)
          ? { CategoryCode: trimmed(declaration.authorisationCategoryCode) }
          : {}),
      },
      // DE 7/4 — mode only. C1 carries no DE 7/14 identity or 7/15 nationality.
      BorderTransportMeans: {
        ModeCode: trimmed(declaration.transportMode),
      },
      ...(carrierEori || carrierName || freightMop || itinerary.length > 0
        ? {
            Consignment: {
              ...(carrierEori || carrierName
                ? {
                    Carrier: {
                      ...(carrierName ? { Name: carrierName } : {}),
                      ...(carrierEori ? { ID: carrierEori.toUpperCase() } : {}),
                    },
                  }
                : {}),
              ...(freightMop ? { Freight: { PaymentMethodCode: freightMop } } : {}),
              ...(itinerary.length > 0 ? { Itinerary: itinerary } : {}),
            },
          }
        : {}),
      // DE 4/15 exchange rate is not on the C1 data set.
      Declarant: { ID: declarantEori },
      // DE 5/12 — customs office of exit.
      ExitOffice: { ID: trimmed(declaration.customsOfficeOfExit).toUpperCase() },
      ...buildB1ExporterBlock(declaration),
      UCR: { TraderAssignedReferenceID: ducr },
      GoodsShipment: {
        // DE 8/5 transaction nature is not on the C1 data set.
        ...buildB1ConsigneeBlock(declaration),
        Consignment: {
          // DE 7/2 — container indicator, mandatory on C1.
          ContainerCode: containerNumber ? "1" : "0",
          // DE 7/7 departure identity is not on the C1 data set.
          GoodsLocation: resolveGoodsLocationForXml(declaration),
          ...(containerNumber || sealId
            ? {
                TransportEquipment: {
                  SequenceNumeric: "1",
                  ...(containerNumber ? { ID: containerNumber } : {}),
                  ...(sealId ? { Seal: { SequenceNumeric: "1", ID: sealId } } : {}),
                },
              }
            : {}),
        },
        Destination: { CountryCode: normalizeCountryCode(declaration.destinationCountry) },
        // DE 5/14 country of dispatch is not on the C1 data set.
        PreviousDocument: [
          { CategoryCode: "Z", TypeCode: "DCR", ID: ducr, LineNumeric: "1" },
        ],
        UCR: { TraderAssignedReferenceID: ducr },
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
          const net = parseFloat(String(item.netWeightKg ?? ""));

          return {
            SequenceNumeric: index + 1,
            // DE 8/6 statistical value is not on the C1 data set.
            ...(additionalDocuments.length > 0
              ? { AdditionalDocument: additionalDocuments }
              : {}),
            Commodity: {
              Description: trimmed(item.description),
              // DE 6/14 is conditional on C1.
              ...(trimmed(item.commodityCode)
                ? { Classification: commodityClassifications(item.commodityCode) }
                : {}),
              GoodsMeasure: {
                // DE 6/5 gross mass is not on the C1 data set; DE 6/1 net is conditional.
                ...(isFinite(net) && net > 0
                  ? { NetNetWeightMeasure: clampNetToGross(item.netWeightKg, item.grossWeightKg || item.netWeightKg) }
                  : {}),
                ...(supplementaryQty
                  ? {
                      TariffQuantity: supplementaryQty,
                      TariffQuantityUnitCode: trimmed(item.supplementaryUnitCode) || "NAR",
                    }
                  : {}),
              },
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
                // DE 6/11 — mandatory on C1.
                MarksNumbersID: trimmed(item.shippingMarks),
                QuantityQuantity: String(parseInt(String(item.packageCount ?? ""), 10) || 0),
                // DE 6/9 — mandatory on C1.
                TypeCode: trimmed(item.packageType),
              },
            ],
          };
        }),
      },
    },
  };
}
