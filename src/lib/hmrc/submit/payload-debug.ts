const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

const fallback = (value: unknown, defaultValue: unknown) => value || defaultValue;

export function buildPayloadDebugSnapshot(payloadInfo: unknown) {
  const root = asRecord(payloadInfo);
  const declaration = asRecord(root.Declaration);
  const shipment = asRecord(declaration.GoodsShipment);
  const consignment = asRecord(shipment.Consignment);
  const goodsItems = Array.isArray(shipment.GovernmentAgencyGoodsItem)
    ? shipment.GovernmentAgencyGoodsItem
    : [];

  return {
    declaration: {
      functionCode: fallback(declaration.FunctionCode, ""),
      functionalReferenceId: fallback(declaration.FunctionalReferenceID, ""),
      typeCode: fallback(declaration.TypeCode, ""),
      declarationOfficeId: fallback(declaration.DeclarationOfficeID, ""),
      invoiceAmount: fallback(declaration.InvoiceAmount, null),
      totalGrossMassMeasure: fallback(declaration.TotalGrossMassMeasure, ""),
      totalPackageQuantity: fallback(declaration.TotalPackageQuantity, ""),
      borderTransportMeans: fallback(declaration.BorderTransportMeans, null),
      declarantId: fallback(asRecord(declaration.Declarant).ID, ""),
      exporterId: fallback(asRecord(declaration.Exporter).ID, ""),
      ucr: fallback(asRecord(declaration.UCR).TraderAssignedReferenceID, ""),
    },
    goodsShipment: {
      buyerCountryCode: fallback(asRecord(shipment.Buyer).AddressCountryCode, ""),
      sellerCountryCode: fallback(asRecord(shipment.Seller).AddressCountryCode, ""),
      destinationCountryCode: fallback(asRecord(shipment.Destination).CountryCode, ""),
      exportCountryId: fallback(asRecord(shipment.ExportCountry).ID, ""),
      importerId: fallback(asRecord(shipment.Importer).ID, ""),
      tradeTerms: fallback(shipment.TradeTerms, null),
      previousDocuments: Array.isArray(shipment.PreviousDocument) ? shipment.PreviousDocument : [],
      consignment: {
        containerCode: fallback(consignment.ContainerCode, ""),
        goodsLocationId: fallback(asRecord(consignment.GoodsLocation).ID, ""),
        arrivalTransportMeans: fallback(consignment.ArrivalTransportMeans, null),
      },
    },
    items: goodsItems.map((source) => {
      const item = asRecord(source);
      const commodity = asRecord(item.Commodity);
      return {
        sequenceNumeric: fallback(item.SequenceNumeric, ""),
        statisticalValueAmount: fallback(item.StatisticalValueAmount, null),
        commodity: {
          description: fallback(commodity.Description, ""),
          classification: Array.isArray(commodity.Classification) ? commodity.Classification : [],
          goodsMeasure: fallback(commodity.GoodsMeasure, null),
        },
        customsValuation: fallback(item.CustomsValuation, null),
        governmentProcedures: Array.isArray(item.GovernmentProcedure) ? item.GovernmentProcedure : [],
        additionalDocuments: Array.isArray(item.AdditionalDocument) ? item.AdditionalDocument : [],
        packaging: Array.isArray(item.Packaging) ? item.Packaging : [],
        origin: fallback(item.Origin, null),
      };
    }),
  };
}
