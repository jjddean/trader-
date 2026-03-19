import { Id } from "../../convex/_generated/dataModel";

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
      TypeCode: "IMA",    
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
