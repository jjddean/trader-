import { Id } from "../../convex/_generated/dataModel";

export function mapToCDS_H1(declaration: any, items: any[]) {
  if (!declaration || typeof declaration !== "object") {
    throw new Error("Invalid declaration object provided to H1 mapper.");
  }

  // Phase 1: Minimal mapping for testing CDS Validation Rules Engine
  return {
    Declaration: {
      FunctionCode: "9", // Original Declaration
      TypeCode: "H1",    // Hardcoded to H1 Standard Import for now
      Declarant: {
        ID: declaration.eori || ""
      },
      GoodsShipment: {
        GovernmentAgencyGoodsItem: (items || []).map((item, index) => ({
          SequenceNumeric: item.sequenceNumber || index + 1,
          Commodity: {
            Classification: [
              {
                ID: item.commodityCode || item.hsCode || "", // HS Code fallback support
                IdentificationTypeCode: "TSP"
              }
            ]
          },
          StatisticalValueAmount: {
            currencyID: item.valueCurrency || "GBP",
            value: item.valueAmount || 0
          },
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
