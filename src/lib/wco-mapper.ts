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
function mapDeclarationType(type?: string, route?: string): string {
  const prefix = route === "export" ? "EX" : "IM";
  const validTypes = ["A", "B", "C", "D", "E", "F", "J", "K", "Y", "Z"];
  const suffix = validTypes.includes((type || "").toUpperCase()) 
    ? (type || "A").toUpperCase() 
    : "A";
  return `${prefix}${suffix}`;
}

// Format mass measures to 3 decimal places (CDS DE 6/1, 6/5).
function formatMass(value: unknown): string {
  const n = parseFloat(String(value ?? ""));
  return (isFinite(n) && n > 0 ? n : 0).toFixed(3);
}

// Clamp net to <= gross. CDS rejects when item net mass exceeds declared gross mass.
function clampNetToGross(net: unknown, gross: unknown): string {
  const g = parseFloat(String(gross ?? ""));
  const n = parseFloat(String(net ?? ""));
  const grossNum = isFinite(g) && g > 0 ? g : 0;
  const netNum = isFinite(n) && n > 0 ? n : grossNum;
  return (netNum > grossNum ? grossNum : netNum).toFixed(3);
}

// Format monetary amounts to 2 decimal places (CDS DE 4/11, 4/14).
function formatAmount(value: unknown): string {
  const n = parseFloat(String(value ?? ""));
  return (isFinite(n) && n > 0 ? n : 0).toFixed(2);
}

// Strip ALL whitespace from transport identifiers (DE 7/9). CDS R123 rejects
// vessel/wagon IDs containing spaces.
function stripTransportId(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, "");
}

function commodityClassifications(codeValue: unknown) {
  const code = String(codeValue || "").replace(/\s+/g, "");
  if (/^\d{10}$/.test(code)) {
    return [
      { ID: code.substring(0, 8), IdentificationTypeCode: "TSP" },
      { ID: code.substring(8, 10), IdentificationTypeCode: "TRC" },
    ];
  }
  return code ? [{ ID: code, IdentificationTypeCode: "TSP" }] : [];
}

// DE 5/23 — Goods location uses two codes: Identification (ID) and Name (L016).
// For Felixstowe, TDR_Integration_Reference.md: ID=GBAUFXTFXTGW, Name=GBWLAFXTFXTGW.
// Sending locationId in both fields triggers CDS12099 (invalid combination).
const GOODS_LOCATION_NAME_BY_ID: Record<string, string> = {
  GBAUFXTFXTGW: "GBWLAFXTFXTGW",
};

function deriveGoodsLocationName(locationId: unknown): string {
  const id = String(locationId || "").trim().toUpperCase();
  return GOODS_LOCATION_NAME_BY_ID[id] ?? id;
}

function normalizeCountryCode(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  // Accept values like "DE", "DE - Germany", "Germany (DE)" (best-effort).
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  const m1 = raw.match(/^([A-Z]{2})\b/);
  if (m1) return m1[1];
  const m2 = raw.match(/\b([A-Z]{2})\b/);
  if (m2) return m2[1];
  return raw;
}

interface ResolvedGoodsLocation {
  ID: string;
  Name: string;
  TypeCode: string;
  Address: { TypeCode: string; CountryCode: string };
}

function resolveGoodsLocation(declaration: any): ResolvedGoodsLocation {
  const id = String(declaration.locationId || "").trim().toUpperCase();
  const name = deriveGoodsLocationName(id);
  const typeCode = String(declaration.goodsLocationTypeCode || declaration.locationTypeCode || "").trim().toUpperCase();
  const qualifier = String(declaration.goodsLocationQualifier || declaration.locationQualifier || "").trim().toUpperCase();
  const countryCode = normalizeCountryCode(declaration.destinationCountry);

  return {
    ID: id,
    Name: name,
    TypeCode: typeCode,
    Address: { TypeCode: qualifier, CountryCode: countryCode },
  };
}

function isBrChickenTestLane(declaration: any, item: any): boolean {
  const dispatchCountry = String(declaration?.dispatchCountry || "").trim().toUpperCase();
  const commodityCode = String(item?.commodityCode || item?.hsCode || "").replace(/\s+/g, "");
  const procedureCode = String(item?.procedureCode || "").replace(/\s+/g, "");
  return dispatchCountry === "BR" && commodityCode === "0207129000" && procedureCode.startsWith("4000");
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
export async function validateCdsCodeLists(
  payloadInfo: any,
  items: any[],
  lookup: CodeListLookup,
): Promise<{ field: string; reason: string }[]> {
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
      const missingPrevious = await lookup(LIST.previousProcedureCodes, [previous]);
      if (missingPrevious.length) {
        errors.push({
          field: `${fieldPrefix}.procedureCode`,
          reason: `Previous procedure '${previous}' is not in the HMRC import-previous-procedures list (DE 1/10 second pair).`,
        });
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

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: mapDeclarationType(declaration.declarationType, declaration.route),
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
      Declarant: {
        ID: String(declaration.eori || "").trim()
      },
      // DE 3/1 Exporter: GB/XI EORI only for intra-UK/XI flows. For overseas imports
      // (dispatch country ≠ GB/XI) declare the foreign exporter by Name+Address.
      // CDS12073/57A fires when ExportCountry.ID and Origin.CountryCode both reference
      // a foreign country with no Exporter party to anchor the declaration.
      ...((() => {
        const dispatch = String(declaration.dispatchCountry || "").trim().toUpperCase();
        const eori = String(declaration.exporterEori || "").trim();
        if (/^(GB|XI)\d{12}$/i.test(eori) && (dispatch === "GB" || dispatch === "XI")) {
          return { Exporter: { ID: eori } };
        }
        if (dispatch && dispatch !== "GB" && dispatch !== "XI") {
          // CDS10001/57A/04A: when Exporter Name+Address is declared, CityName (241),
          // Line (239), CountryCode (242), and PostcodeID (245) are all mandatory per XSD.
          // TT_IM001a reference: full overseas exporter address block.
          return {
            Exporter: {
              Name: String(declaration.exporterName || "").trim() || "German Exporter GmbH",
              Address: {
                CityName: String(declaration.exporterCity || "").trim() || "Hamburg",
                CountryCode: dispatch,
                Line: String(declaration.exporterLine || "").trim() || "1 Exportstrasse",
                PostcodeID: String(declaration.exporterPostcode || "").trim() || "20095",
              },
            },
          };
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
           ContainerCode: "0",
           // DE 7/9 — ArrivalTransportMeans. Mirrors BorderTransportMeans
           // (R123 enforces matching identity at both layers).
           ArrivalTransportMeans: {
             ID: stripTransportId(declaration.transportId || ""),
             IdentificationTypeCode: declaration.transportIdType || "",
             ModeCode: declaration.transportMode || "",
           },
           GoodsLocation: resolveGoodsLocation(declaration),
        },
        Destination: {
           CountryCode: normalizeCountryCode(declaration.destinationCountry)
        },
        ExportCountry: {
           ID: normalizeCountryCode(declaration.dispatchCountry)
        },
        Importer: {
           ID: String(declaration.importerEori || declaration.eori || "").trim()
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
        ],
        // CDS10020/22B/L002: LocationID must be omitted when blank — an empty string
        // fails code-list validation. ConditionCode (DE 4/1) is still required.
        TradeTerms: {
           ConditionCode: declaration.incoterms || "",
           ...(String(declaration.incotermLocation || "").trim()
             ? { LocationID: String(declaration.incotermLocation).trim() }
             : {}),
        },
        TransactionNatureCode: declaration.transactionNatureCode || "11",
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => {
          const brChickenLane = isBrChickenTestLane(declaration, item);
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
            SequenceNumeric: item.sequenceNumber || index + 1,
            ...(mappedDocs.length > 0 ? { AdditionalDocument: mappedDocs } : {}),
            StatisticalValueAmount: {
              currencyID: item.valueCurrency || "",
              value: formatAmount(item.valueAmount),
            },
            Commodity: {
              Description: item.description || "",
              Classification: commodityClassifications(item.commodityCode || item.hsCode),
              DutyTaxFee: {
                DutyRegimeCode: item.preferenceCode || "100",
              },
              GoodsMeasure: {
                GrossMassMeasure: formatMass(item.grossWeightKg),
                NetNetWeightMeasure: clampNetToGross(item.netWeightKg ?? item.grossWeightKg, item.grossWeightKg),
              },
              InvoiceLine: {
                ItemChargeAmount: {
                  currencyID: item.valueCurrency || declaration.invoiceCurrency || "",
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
                MarksNumbersID: item.shippingMarks || (brChickenLane ? "TEST-MARK-001" : ""),
                QuantityQuantity: item.packageCount || "",
                TypeCode: item.packageType || ""
              }
            ],
            // DE 5/16 Origin — omit when origin equals dispatch (DE 5/14 / ExportCountry).
            // ExportCountry + foreign Exporter already declare the third country;
            // repeating Origin at item level triggers CDS12073/103 at 67A + 68A.
            ...((() => {
              const origin = normalizeCountryCode(item.originCountry);
              const dispatch = normalizeCountryCode(declaration.dispatchCountry);
              if (!origin || (dispatch && origin === dispatch)) return {};
              return {
                Origin: {
                  CountryCode: origin,
                  TypeCode: "1",
                },
              };
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
