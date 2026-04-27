
const currencyValues =
  typeof Intl.supportedValuesOf === "function" ? new Set(Intl.supportedValuesOf("currency")) : null;
const regionName = new Intl.DisplayNames(["en"], { type: "region" });

export function validateCdsFields(declaration: any, items: any[], payloadInfo: any) {
  const errors: { field: string; reason: string }[] = [];
  const eori = declaration?.eori || payloadInfo?.Declaration?.Declarant?.ID || "";
  if (!/^GB\d{12}$/.test(String(eori))) {
    errors.push({ field: "eori", reason: "EORI must match format GB followed by 12 digits" });
  }

  const invoiceCurrency = payloadInfo?.Declaration?.InvoiceAmount?.currencyID;
  if (!isValidIsoCurrency(invoiceCurrency)) {
    errors.push({ field: "invoiceCurrency", reason: "Currency must be a valid ISO 4217 code" });
  }

  const destinationCountry = payloadInfo?.Declaration?.GoodsShipment?.Destination?.CountryCode;
  if (!isValidIsoCountryCode(destinationCountry)) {
    errors.push({ field: "destinationCountry", reason: "Country code must be valid ISO 3166-1 alpha-2" });
  }

  const exportCountry = payloadInfo?.Declaration?.GoodsShipment?.ExportCountry?.ID;
  if (!exportCountry || !isValidIsoCountryCode(exportCountry)) {
    errors.push({ field: "dispatchCountry", reason: "Dispatch country (DE 5/14) is required — set the country goods were shipped FROM, e.g. BR for Brazil. Never leave blank." });
  }

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const commodityCode = String(item?.commodityCode || item?.hsCode || "");
    if (!/^\d{10}$/.test(commodityCode)) {
      errors.push({ field: `items[${i}].commodityCode`, reason: "Commodity code must be exactly 10 digits" });
    }

    const cpc = String((item?.procedureCode?.replace(/\s+/g, "") || "").substring(0, 4));
    if (!/^\d{4}$/.test(cpc)) {
      errors.push({ field: `items[${i}].procedureCode`, reason: "Procedure code must be a valid 4-digit CPC" });
    }

    const originCountry = String(item?.originCountry || "");
    if (originCountry && !isValidIsoCountryCode(originCountry)) {
      errors.push({ field: `items[${i}].originCountry`, reason: "Country code must be valid ISO 3166-1 alpha-2" });
    }

    const valueCurrency = String(item?.valueCurrency || invoiceCurrency || "");
    if (valueCurrency && !isValidIsoCurrency(valueCurrency)) {
      errors.push({ field: `items[${i}].valueCurrency`, reason: "Currency must be a valid ISO 4217 code" });
    }
  }

  const dateFields = [
    { key: "acceptanceDate", value: declaration?.acceptanceDate },
    { key: "clearanceDate", value: declaration?.clearanceDate },
    { key: "declarationDate", value: declaration?.declarationDate },
  ];
  for (const dateField of dateFields) {
    if (dateField.value && !/^\d{8}$/.test(String(dateField.value))) {
      errors.push({ field: dateField.key, reason: "Date must use YYYYMMDD format" });
    }
  }

  return errors;
}

function isValidIsoCurrency(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || !/^[A-Z]{3}$/.test(normalized)) return false;
  if (!currencyValues) return true;
  return currencyValues.has(normalized);
}

function isValidIsoCountryCode(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return false;
  const resolved = regionName.of(normalized);
  return !!resolved && resolved !== normalized;
}

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

  // Automatically calculate totals from items if not provided
  const totalGrossWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;
  const ducr = declaration.ducr || `${new Date().getFullYear() % 10}GB${String(declaration.eori || "GB123456789000").trim().replace(/^GB/i, "")}-${declaration._id.substring(0,6).toUpperCase()}`;

  return {
    Declaration: {
      FunctionCode: "9",
      TypeCode: mapDeclarationType(declaration.declarationType, declaration.route),
      FunctionalReferenceID: declaration.lrn || `FC-${Date.now().toString(36).toUpperCase()}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "GBLON004",
      TotalGrossMassMeasure: formatMass(declaration.totalGrossWeight || totalGrossWeight),
      TotalPackageQuantity: items.reduce((acc: number, item: any) => acc + (parseInt(item.packageCount) || 1), 0),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "GBP",
        value: formatAmount(declaration.invoiceTotal || invoiceTotal),
      },
      CurrencyExchange: {
        CurrencyTypeCode: declaration.invoiceCurrency || "GBP"
      },
      // DE 7/14 + 7/15 — BorderTransportMeans at Declaration level (the means
      // crossing the UK border). For IMA imports CDS expects BOTH this AND
      // ArrivalTransportMeans inside Consignment — see R123. Both must carry
      // the full transport identity (ID + IdentificationTypeCode + ModeCode);
      // ModeCode-only fails CDS12073 + R123.
      BorderTransportMeans: {
        ID: stripTransportId(declaration.transportId || "CSCLGLOBE"),
        IdentificationTypeCode: declaration.transportIdType || "11",
        ModeCode: declaration.transportMode || "1",
      },
      Declarant: {
        ID: String(declaration.eori || "").trim()
      },
      // Exporter: only include a GB/XI EORI — never fall back to the declarant's own EORI.
      // HMRC DE 3/2: "Do NOT enter if the exporter is not UK-based."
      // For non-UK exporters the submission route omits the Exporter element entirely.
      Exporter: {
        ID: declaration.exporterEori || ""
      },
      UCR: {
        TraderAssignedReferenceID: ducr
      },
      GoodsShipment: {
        // DE 3/24 — Buyer (UK importer). Country code is GB for imports;
        // Name is intentionally omitted until real party data is plumbed in.
        Buyer: {
          AddressCountryCode: declaration.destinationCountry || "GB",
          Name: declaration.buyerName || "",
        },
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
             ID: stripTransportId(declaration.transportId || "CSCLGLOBE"),
             IdentificationTypeCode: declaration.transportIdType || "11",
             ModeCode: declaration.transportMode || "1",
           },
           GoodsLocation: {
             ID: declaration.locationId || "GBAUFXTFXTGW"
           }
        },
        Destination: {
           CountryCode: declaration.destinationCountry || "GB"
        },
        ExportCountry: {
           ID: declaration.dispatchCountry || ""
        },
        Importer: {
           ID: String(declaration.importerEori || declaration.eori || "").trim()
        },
        // DE 3/1 — Seller. Country derived from dispatch country (where goods
        // shipped FROM). Name omitted until real party data is plumbed in.
        Seller: {
          AddressCountryCode: declaration.dispatchCountry || "",
          Name: declaration.sellerName || "",
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
        TradeTerms: {
           ConditionCode: declaration.incoterms || "FOB",
           LocationID: declaration.incotermLocation || "GBFXT"
        },
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
              const statusCode = String(source.StatusCode || source.statusCode || "").trim();
              if (statusCode) mapped.StatusCode = statusCode;
              return mapped;
            })
            .filter((doc) => doc.CategoryCode && doc.TypeCode && doc.ID)
            .filter((doc) => !forbiddenSet.has(`${doc.CategoryCode}${doc.TypeCode}`.toUpperCase()));

          return {
            SequenceNumeric: item.sequenceNumber || index + 1,
            ...(mappedDocs.length > 0 ? { AdditionalDocument: mappedDocs } : {}),
            StatisticalValueAmount: {
              currencyID: item.valueCurrency || "GBP",
              value: formatAmount(item.valueAmount),
            },
            Commodity: {
              Description: item.description || "General goods",
              Classification: [
                {
                  ID: item.commodityCode || item.hsCode || "",
                  IdentificationTypeCode: "TSP"
                }
              ],
              GoodsMeasure: {
                GrossMassMeasure: formatMass(item.grossWeightKg),
                NetNetWeightMeasure: clampNetToGross(item.netWeightKg ?? item.grossWeightKg, item.grossWeightKg),
              }
            },
            // DE 4/16 — Customs valuation method. "1" = transaction value of the imported goods.
            CustomsValuation: {
              MethodCode: "1",
            },
            Packaging: [
              {
                SequenceNumeric: "1",
                MarksNumbersID: item.shippingMarks || "N/A",
                QuantityQuantity: item.packageCount || "1",
                TypeCode: item.packageType || "PK"
              }
            ],
            // DE 5/16: Country of Origin — mandatory for most H1 imports.
            // TypeCode "1" = non-preferential origin declaration.
            ...(item.originCountry ? {
              Origin: {
                CountryCode: item.originCountry,
                TypeCode: "1"
              }
            } : {}),
            GovernmentProcedure: [
              {
                // DE 1/10: Requested and Previous Procedure (e.g., 40 00)
                CurrentCode: (item.procedureCode?.replace(/\s+/g, '') || "4000").substring(0, 2),
                PreviousCode: (item.procedureCode?.replace(/\s+/g, '') || "4000").substring(2, 4) || "00"
              },
              {
                // DE 1/11: Additional Procedure Code (e.g., 000)
                CurrentCode: item.additionalProcedureCode || "000"
              }
            ]
          };
        })
      }
    }
  };
}
