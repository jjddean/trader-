import { Id } from "../../convex/_generated/dataModel";

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
  if (!isValidIsoCountryCode(exportCountry)) {
    errors.push({ field: "dispatchCountry", reason: "Country code must be valid ISO 3166-1 alpha-2" });
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

export function mapToCDS_H1(declaration: any, items: any[]) {
  if (!declaration || typeof declaration !== "object") {
    throw new Error("Invalid declaration object provided to H1 mapper.");
  }

  // Automatically calculate totals from items if not provided
  const totalGrossWeight = items.reduce((acc: number, item: any) => acc + (parseFloat(item.grossWeightKg) || 0), 0) || 100;
  const invoiceTotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.valueAmount) || 0), 0) || 1000;

  return {
    Declaration: {
      FunctionCode: "9", 
      TypeCode: mapDeclarationType(declaration.declarationType, declaration.route),    
      FunctionalReferenceID: declaration.lrn || `FC-${declaration._id}`,
      GoodsItemQuantity: items.length || 1,
      DeclarationOfficeID: declaration.presentationOffice || "GB000051",
      TotalGrossMassMeasure: declaration.totalGrossWeight || totalGrossWeight,
      TotalPackageQuantity: items.reduce((acc: number, item: any) => acc + (parseInt(item.packageCount) || 1), 0),
      InvoiceAmount: {
        currencyID: declaration.invoiceCurrency || "GBP",
        value: declaration.invoiceTotal || invoiceTotal
      },
      CurrencyExchange: {
        CurrencyTypeCode: declaration.invoiceCurrency || "GBP"
      },
      Declarant: {
        ID: declaration.eori || ""
      },
      Exporter: {
        ID: declaration.exporterEori || "GB123456789000"
      },
      UCR: {
        TraderAssignedReferenceID: declaration.ducr || `9GB${declaration.eori || "123456789000"}-${declaration._id.substring(0,6).toUpperCase()}`
      },
      GoodsShipment: {
        Consignment: {
           ContainerCode: "0",
           BorderTransportMeans: {
             IdentificationTypeCode: "11",
             ID: declaration.transportId || "CSCL GLOBE",
             ModeCode: declaration.transportMode || "1"
           },
           GoodsLocation: {
             Name: declaration.locationName || "GBWLAFXTFXTGW",
             ID: declaration.locationId || "GBAUFXTFXTGW"
           }
        },
        Destination: {
           CountryCode: declaration.destinationCountry || "GB"
        },
        ExportCountry: {
           ID: declaration.dispatchCountry || "US"
        },
        Importer: {
           ID: declaration.importerEori || declaration.eori || ""
        },
        TradeTerms: {
           ConditionCode: declaration.incoterms || "FOB",
           LocationID: declaration.incotermLocation || "GBFXT"
        },
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => ({
          SequenceNumeric: item.sequenceNumber || index + 1,
          AdditionalDocument: [
            {
              CategoryCode: "Y",
              ID: "922",
              TypeCode: "922"
            }
          ],
          StatisticalValueAmount: {
            currencyID: item.valueCurrency || "GBP",
            value: item.valueAmount || 0
          },
          Commodity: {
            Classification: [
              {
                ID: item.commodityCode || item.hsCode || "",
                IdentificationTypeCode: "TSP"
              }
            ],
            GoodsMeasure: {
              GrossMassMeasure: item.grossWeightKg || 10,
              NetNetWeightMeasure: item.netWeightKg || 9
            }
          },
          Packaging: [
            {
              SequenceNumeric: "1",
              MarksNumbersID: item.shippingMarks || "N/A",
              QuantityQuantity: item.packageCount || "1",
              TypeCode: item.packageType || "PK"
            }
          ],
          GovernmentProcedure: [
            {
              CurrentCode: (item.procedureCode?.replace(/\s+/g, '') || "4000000").substring(0, 4),
              PreviousCode: (item.procedureCode?.replace(/\s+/g, '') || "4000000").substring(4, 7) || "000"
            }
          ]
        }))
      }
    }
  };
}
