/**
 * DE mapping for the B1 standard export / re-export declaration category.
 *
 * Obligation source: `docs/hmrc/specs/cds-api/appendix-22a-b1-obligations.md`
 * (transcribed from GOV.UK Appendix 22A, 2026-08-21).
 * WCO element paths: `convex/lib/cds_wco_references.ts`.
 * Element ordering: `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`.
 *
 * B1 is NOT H1 with fields hidden. The import data set carries elements that do
 * not exist on an export declaration and must never be emitted here — see
 * IMPORT_ONLY_FIELDS below. Validation lives in `validateB1Declaration()`;
 * the mapper assumes it has already run and throws only on invariants it
 * cannot express as a payload.
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

export interface B1MapOptions {
  /** Skip DE 2/3 emission — used by the dry-run preflight. */
  omitAdditionalDocuments?: boolean;
  /** DE 2/3 codes the rule engine has forbidden for this declaration. */
  forbiddenDocCodes?: string[];
}

/**
 * Declaration fields that belong to the import data sets (H1/I1) and have no
 * place on a B1. Presence of any of these signals the caller built an import
 * payload and routed it at an export category.
 */
export const IMPORT_ONLY_FIELDS = [
  "importerEori",
  "incoterms",
  "incotermLocation",
  "defermentAccountNumber",
  "paymentMethodCode",
  "valuationMethod",
  "preferenceCode",
] as const;

/** DE 8/6 statistical value currency. CDS requires GBP on export declarations. */
const STATISTICAL_VALUE_CURRENCY = "GBP";

function trimmed(value: unknown): string {
  return String(value ?? "").trim();
}

function isGbXiEori(value: unknown): boolean {
  return /^(GB|XI)\d{12}$/i.test(trimmed(value));
}

/**
 * DE 3/1 + 3/2 — Exporter, header level only on B1 (Appendix 22A).
 * EORI form when the exporter holds a GB/XI EORI, otherwise Name + Address.
 * Unlike the import path, the address country is the exporter's own country,
 * not the dispatch country: on an export they are the same party.
 */
export function buildB1ExporterBlock(declaration: Record<string, unknown>) {
  const eori = trimmed(declaration.exporterEori);
  if (isGbXiEori(eori)) {
    return { Exporter: { ID: eori.toUpperCase() } };
  }
  const name = trimmed(declaration.exporterName);
  const city = trimmed(declaration.exporterCity);
  const line = trimmed(declaration.exporterLine);
  const postcode = trimmed(declaration.exporterPostcode);
  const country =
    normalizeCountryCode(declaration.exporterCountry)
    || normalizeCountryCode(declaration.dispatchCountry)
    || "GB";
  if (!name || !city || !line || !postcode) return {};
  return {
    Exporter: {
      Name: name,
      Address: { CityName: city, CountryCode: country, Line: line, PostcodeID: postcode },
    },
  };
}

/**
 * DE 3/9 + 3/10 — Consignee. The receiving party on an export. This is NOT
 * DE 3/15/3/16 Importer, which does not exist on B1.
 */
export function buildB1ConsigneeBlock(declaration: Record<string, unknown>) {
  const id = trimmed(declaration.consigneeEori);
  const name = trimmed(declaration.consigneeName);
  const city = trimmed(declaration.consigneeCity);
  const line = trimmed(declaration.consigneeLine);
  const postcode = trimmed(declaration.consigneePostcode);
  const country =
    normalizeCountryCode(declaration.consigneeCountry)
    || normalizeCountryCode(declaration.destinationCountry);
  if (!id && !name) return {};
  const hasAddress = Boolean(name && city && line && country);
  return {
    Consignee: {
      ...(name ? { Name: name } : {}),
      ...(id ? { ID: id.toUpperCase() } : {}),
      ...(hasAddress
        ? {
            Address: {
              CityName: city,
              CountryCode: country,
              Line: line,
              ...(postcode ? { PostcodeID: postcode } : {}),
            },
          }
        : {}),
    },
  };
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
  if (codes.length === 0) return [];
  return codes.map((code, i) => ({ SequenceNumeric: String(i + 1), RoutingCountryCode: code }));
}

/**
 * `Declaration/Consignment` — DE 3/31, 3/32 (Carrier), 4/2 (Freight payment
 * method) and 5/18 (Itinerary). Distinct from `GoodsShipment/Consignment`.
 */
function buildDeclarationConsignment(declaration: Record<string, unknown>) {
  const carrierEori = trimmed(declaration.carrierEori);
  const carrierName = trimmed(declaration.carrierName);
  const freightMop = trimmed(declaration.transportChargesMethodOfPayment);
  const itinerary = buildItinerary(declaration);
  const carrier = carrierEori || carrierName
    ? {
        Carrier: {
          ...(carrierName ? { Name: carrierName } : {}),
          ...(carrierEori ? { ID: carrierEori.toUpperCase() } : {}),
        },
      }
    : {};
  const freight = freightMop ? { Freight: { PaymentMethodCode: freightMop } } : {};
  if (!carrierEori && !carrierName && !freightMop && itinerary.length === 0) return {};
  return {
    Consignment: {
      ...carrier,
      ...freight,
      ...(itinerary.length > 0 ? { Itinerary: itinerary } : {}),
    },
  };
}

/** DE 7/18 — seals, carried on TransportEquipment. */
function buildTransportEquipment(declaration: Record<string, unknown>) {
  const containerId = trimmed(declaration.containerId);
  const sealId = trimmed(declaration.sealNumber);
  if (!containerId && !sealId) return {};
  return {
    TransportEquipment: {
      SequenceNumeric: "1",
      ...(containerId ? { ID: containerId } : {}),
      ...(sealId ? { Seal: { SequenceNumeric: "1", ID: sealId } } : {}),
    },
  };
}

/**
 * Mandatory-element validation for B1, per the Appendix 22A A-rows.
 * Returns human-readable errors; empty array means the payload can be built.
 */
export function validateB1Declaration(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
): string[] {
  const errors: string[] = [];

  // `route` is overloaded on this table: it holds HMRC's document-check route
  // ("Route 1") on rows created through the dashboard, and the trade direction
  // ("import"/"export") on rows built by the mappers and fixtures. The category
  // is what selects the data set, so direction is only cross-checked when the
  // field actually carries a direction.
  const routeValue = trimmed(declaration.route).toLowerCase();
  if (routeValue === "import") {
    errors.push('Declaration route is "import" but B1 is an export data set');
  }
  const category = trimmed(declaration.declarationCategory).toUpperCase();
  if (category && category !== "B1") {
    errors.push(`Declaration category ${category} routed to the B1 mapper`);
  }

  // DE 1/2 — additional declaration type.
  if (!trimmed(declaration.declarationType)) {
    errors.push("Missing additional declaration type (DE 1/2)");
  }
  // DE 2/5 LRN is not validated here — like the H1 path, the mapper generates
  // one when the caller has not assigned it yet.
  // DE 3/18 — declarant EORI.
  if (!trimmed(declaration.eori)) {
    errors.push("Missing declarant EORI (DE 3/18)");
  }
  // DE 5/8 — country of destination.
  if (!normalizeCountryCode(declaration.destinationCountry)) {
    errors.push("Missing country of destination (DE 5/8)");
  }
  // DE 5/12 — customs office of exit. Mandatory on B1, no import equivalent.
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
  // DE 8/5 — nature of transaction.
  if (!trimmed(declaration.transactionNatureCode)) {
    errors.push("Missing transaction nature code (DE 8/5)");
  }

  const present = IMPORT_ONLY_FIELDS.filter((f) => trimmed(declaration[f]));
  if (present.length > 0) {
    errors.push(
      `Import-only data elements are not valid on a B1 declaration: ${present.join(", ")}`,
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("A B1 declaration must carry at least one goods item (DE 1/6)");
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
    // DE 6/8 — description of goods.
    if (!trimmed(item.description)) errors.push(`Item ${n}: missing goods description (DE 6/8)`);
    // DE 6/14 — commodity code.
    if (!trimmed(item.commodityCode)) errors.push(`Item ${n}: missing commodity code (DE 6/14)`);
    // DE 6/1 — net mass. Mandatory on B1 (conditional on H1).
    const net = parseFloat(String(item.netWeightKg ?? ""));
    if (!isFinite(net) || net <= 0) errors.push(`Item ${n}: missing net mass (DE 6/1)`);
    // DE 6/5 — gross mass.
    const gross = parseFloat(String(item.grossWeightKg ?? ""));
    if (!isFinite(gross) || gross <= 0) errors.push(`Item ${n}: missing gross mass (DE 6/5)`);
    // DE 6/10 — number of packages.
    const pkgs = parseInt(String(item.packageCount ?? ""), 10);
    if (!isFinite(pkgs) || pkgs <= 0) errors.push(`Item ${n}: missing number of packages (DE 6/10)`);
  });

  return errors;
}

export function mapToCDS_B1(
  declaration: Record<string, unknown>,
  items: Record<string, unknown>[],
  options: B1MapOptions = {},
) {
  const errors = validateB1Declaration(declaration, items);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const forbiddenSet = new Set(
    (options.forbiddenDocCodes || []).map((c) => String(c).toUpperCase()),
  );
  const declarantEori = trimmed(declaration.eori).toUpperCase();
  const lrn = trimmed(declaration.lrn) || `FC-${Date.now().toString(36).toUpperCase()}`;
  // DUCR derivation mirrors the H1 path: year digit + GB + EORI body + record id.
  const ducr =
    trimmed(declaration.ducr)
    || `${new Date().getFullYear() % 10}GB${declarantEori.replace(/^GB/i, "")}-${trimmed(declaration._id).substring(0, 6).toUpperCase() || "B1EXPT"}`;
  const currency = trimmed(declaration.invoiceCurrency) || STATISTICAL_VALUE_CURRENCY;

  const totalGrossWeight = items.reduce(
    (acc, item) => acc + (parseFloat(String(item.grossWeightKg ?? "")) || 0),
    0,
  );
  const totalPackages = items.reduce(
    (acc, item) => acc + (parseInt(String(item.packageCount ?? ""), 10) || 0),
    0,
  );

  const exchangeRate = trimmed(declaration.exchangeRate);
  const authorisationHolder = trimmed(declaration.authorisationHolderEori);
  const authorisationCategory = trimmed(declaration.authorisationCategoryCode);

  return {
    Declaration: {
      FunctionCode: "9",
      // DE 1/1 + 1/2 — EX prefix, never IM.
      TypeCode: mapDeclarationType(trimmed(declaration.declarationType), "export"),
      FunctionalReferenceID: lrn,
      GoodsItemQuantity: items.length,
      DeclarationOfficeID: trimmed(declaration.presentationOffice),
      InvoiceAmount: {
        currencyID: currency,
        value: formatAmount(declaration.invoiceTotal),
      },
      TotalGrossMassMeasure: formatMass(declaration.totalGrossWeight || totalGrossWeight),
      TotalPackageQuantity: totalPackages,
      // DE 3/39 — holder of the authorisation (conditional on B1).
      ...(authorisationHolder
        ? {
            AuthorisationHolder: {
              ID: authorisationHolder.toUpperCase(),
              ...(authorisationCategory ? { CategoryCode: authorisationCategory } : {}),
            },
          }
        : {}),
      // DE 7/14 + 7/15 — active means crossing the border.
      BorderTransportMeans: {
        ID: stripTransportId(declaration.borderTransportId || declaration.transportId),
        IdentificationTypeCode: trimmed(
          declaration.borderTransportIdType || declaration.transportIdType,
        ),
        ...(normalizeCountryCode(declaration.borderTransportNationality)
          ? {
              RegistrationNationalityCode: normalizeCountryCode(
                declaration.borderTransportNationality,
              ),
            }
          : {}),
        ModeCode: trimmed(declaration.transportMode),
      },
      ...buildDeclarationConsignment(declaration),
      // DE 4/15 — exchange rate.
      ...(exchangeRate
        ? { CurrencyExchange: { CurrencyTypeCode: currency, RateNumeric: exchangeRate } }
        : {}),
      Declarant: { ID: declarantEori },
      // DE 5/12 — customs office of exit.
      ExitOffice: { ID: trimmed(declaration.customsOfficeOfExit).toUpperCase() },
      ...buildB1ExporterBlock(declaration),
      UCR: { TraderAssignedReferenceID: ducr },
      GoodsShipment: {
        // DE 8/5.
        TransactionNatureCode: trimmed(declaration.transactionNatureCode),
        ...buildB1ConsigneeBlock(declaration),
        Consignment: {
          ContainerCode: trimmed(declaration.containerId) ? "1" : "0",
          // DE 7/7 — identity at departure. Export never carries
          // ArrivalTransportMeans.
          ...(stripTransportId(declaration.departureTransportId || declaration.transportId)
            ? {
                DepartureTransportMeans: {
                  ID: stripTransportId(
                    declaration.departureTransportId || declaration.transportId,
                  ),
                  IdentificationTypeCode: trimmed(
                    declaration.departureTransportIdType || declaration.transportIdType,
                  ),
                  // DE 7/5 — inland mode of transport.
                  ...(trimmed(declaration.inlandTransportMode)
                    ? { ModeCode: trimmed(declaration.inlandTransportMode) }
                    : {}),
                },
              }
            : {}),
          GoodsLocation: resolveGoodsLocationForXml(declaration),
          ...buildTransportEquipment(declaration),
        },
        Destination: { CountryCode: normalizeCountryCode(declaration.destinationCountry) },
        // DE 5/14 — country of dispatch/export. Header level, conditional.
        ...(normalizeCountryCode(declaration.dispatchCountry)
          ? { ExportCountry: { ID: normalizeCountryCode(declaration.dispatchCountry) } }
          : {}),
        // DE 2/1 — previous documents. DUCR anchors the pointer chain.
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

          return {
            SequenceNumeric: index + 1,
            // DE 8/6 — statistical value. Conditional on B1, emitted when known.
            ...(item.statisticalValue != null || item.valueAmount != null
              ? {
                  StatisticalValueAmount: {
                    currencyID: STATISTICAL_VALUE_CURRENCY,
                    value: formatAmount(item.statisticalValue ?? item.valueAmount),
                  },
                }
              : {}),
            ...(additionalDocuments.length > 0
              ? { AdditionalDocument: additionalDocuments }
              : {}),
            Commodity: {
              Description: trimmed(item.description),
              Classification: commodityClassifications(item.commodityCode),
              GoodsMeasure: {
                GrossMassMeasure: formatMass(item.grossWeightKg),
                NetNetWeightMeasure: clampNetToGross(item.netWeightKg, item.grossWeightKg),
                ...(supplementaryQty
                  ? {
                      TariffQuantity: supplementaryQty,
                      TariffQuantityUnitCode: trimmed(item.supplementaryUnitCode) || "NAR",
                    }
                  : {}),
              },
            },
            // DE 1/10 requested + previous procedure (e.g. 1000), then DE 1/11.
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
            // DE 5/15 — country of origin, conditional at item level.
            ...(normalizeCountryCode(item.originCountry)
              ? { Origin: { CountryCode: normalizeCountryCode(item.originCountry), TypeCode: "1" } }
              : {}),
            Packaging: [
              {
                SequenceNumeric: "1",
                // DE 6/11 — shipping marks, conditional on B1.
                ...(trimmed(item.shippingMarks)
                  ? { MarksNumbersID: trimmed(item.shippingMarks) }
                  : {}),
                QuantityQuantity: String(parseInt(String(item.packageCount ?? ""), 10) || 0),
                // DE 6/9 — package type, conditional on B1.
                ...(trimmed(item.packageType) ? { TypeCode: trimmed(item.packageType) } : {}),
              },
            ],
          };
        }),
      },
    },
  };
}
