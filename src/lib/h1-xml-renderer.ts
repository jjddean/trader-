import { xmlEscape } from "./xml-utils";

type XmlRecord = Record<string, unknown>;

const asRecord = (value: unknown): XmlRecord => (
  typeof value === "object" && value !== null ? value as XmlRecord : {}
);

const asArray = (value: unknown): XmlRecord[] => (
  Array.isArray(value) ? value.map(asRecord) : []
);

const read = (source: XmlRecord, key: string): XmlRecord => asRecord(source[key]);
const text = (source: XmlRecord, key: string): string => String(source[key] ?? "");

export function validateXmlPreflight(
  xmlPayload: string,
  eori: string,
  opts: { requireAdditionalDocument?: boolean } = {},
) {
  const requireAdditionalDocument = opts.requireAdditionalDocument !== false;
  const checks: Record<string, boolean> = {
    has_metadata: xmlPayload.includes("<MetaData"),
    has_declaration: xmlPayload.includes("<Declaration"),
    has_function_code: xmlPayload.includes("<FunctionCode>9</FunctionCode>"),
    has_type_code: /<TypeCode>(IM[A-Z]|EX[A-Z])<\/TypeCode>/.test(xmlPayload),
    has_declarant_id: xmlPayload.includes(`<ID>${eori}</ID>`),
    has_goods_shipment: xmlPayload.includes("<GoodsShipment>"),
    has_previous_document: xmlPayload.includes("<PreviousDocument>"),
    no_y922: !xmlPayload.includes("<TypeCode>922</TypeCode>"),
    no_empty_tags: !/<([A-Za-z][\w]*)\s*>\s*<\/\1>/.test(xmlPayload),
    no_placeholders: !/(>\s*N\/A\s*<|>\s*TBD\s*<|>\s*PENDING-|>\s*General goods\s*<)/i.test(xmlPayload),
  };
  if (requireAdditionalDocument) {
    checks.has_additional_document = xmlPayload.includes("<AdditionalDocument>");
  }
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([key]) => key);
  return {
    valid: failed.length === 0,
    failed,
  };
}

export function buildPayloadDebugSnapshot(payloadInfo: unknown) {
  const declaration = read(asRecord(payloadInfo), "Declaration");
  const shipment = read(declaration, "GoodsShipment");
  const goodsItems = asArray(shipment.GovernmentAgencyGoodsItem);
  const consignment = read(shipment, "Consignment");

  return {
    declaration: {
      functionCode: text(declaration, "FunctionCode"),
      functionalReferenceId: text(declaration, "FunctionalReferenceID"),
      typeCode: text(declaration, "TypeCode"),
      declarationOfficeId: text(declaration, "DeclarationOfficeID"),
      invoiceAmount: declaration.InvoiceAmount || null,
      totalGrossMassMeasure: text(declaration, "TotalGrossMassMeasure"),
      totalPackageQuantity: text(declaration, "TotalPackageQuantity"),
      borderTransportMeans: declaration.BorderTransportMeans || null,
      declarantId: text(read(declaration, "Declarant"), "ID"),
      exporterId: text(read(declaration, "Exporter"), "ID"),
      ucr: text(read(declaration, "UCR"), "TraderAssignedReferenceID"),
    },
    goodsShipment: {
      buyerCountryCode: text(read(shipment, "Buyer"), "AddressCountryCode"),
      sellerCountryCode: text(read(shipment, "Seller"), "AddressCountryCode"),
      destinationCountryCode: text(read(shipment, "Destination"), "CountryCode"),
      exportCountryId: text(read(shipment, "ExportCountry"), "ID"),
      importerId: text(read(shipment, "Importer"), "ID"),
      tradeTerms: shipment.TradeTerms || null,
      previousDocuments: asArray(shipment.PreviousDocument),
      consignment: {
        containerCode: text(consignment, "ContainerCode"),
        goodsLocationId: text(read(consignment, "GoodsLocation"), "ID"),
        arrivalTransportMeans: consignment.ArrivalTransportMeans || null,
      },
    },
    items: goodsItems.map((item) => ({
      sequenceNumeric: text(item, "SequenceNumeric"),
      statisticalValueAmount: item.StatisticalValueAmount || null,
      commodity: {
        description: text(read(item, "Commodity"), "Description"),
        classification: asArray(read(item, "Commodity").Classification),
        goodsMeasure: read(item, "Commodity").GoodsMeasure || null,
      },
      customsValuation: item.CustomsValuation || null,
      governmentProcedures: asArray(item.GovernmentProcedure),
      additionalDocuments: asArray(item.AdditionalDocument),
      packaging: asArray(item.Packaging),
      origin: item.Origin || null,
    })),
  };
}

export function renderH1Xml(payloadInfo: unknown): string {
  const d = read(asRecord(payloadInfo), "Declaration");
  const gs = read(d, "GoodsShipment");
  const consignment = read(gs, "Consignment");
  const exporterEori = text(read(d, "Exporter"), "ID").trim();
  const exporterXml = /^(GB|XI)\d{12}$/i.test(exporterEori)
    ? `\n    <Exporter>\n      <ID>${xmlEscape(exporterEori)}</ID>\n    </Exporter>`
    : "";
  const previousDocs = asArray(gs.PreviousDocument);
  const previousDocumentXml = previousDocs.map((pd) => `
      <PreviousDocument>
        <CategoryCode>${xmlEscape(pd.CategoryCode || "")}</CategoryCode>
        <ID>${xmlEscape(pd.ID || "")}</ID>
        <TypeCode>${xmlEscape(pd.TypeCode || "")}</TypeCode>${pd.LineNumeric ? `\n        <LineNumeric>${xmlEscape(pd.LineNumeric)}</LineNumeric>` : ""}
      </PreviousDocument>`).join("");
  const btm = read(d, "BorderTransportMeans");
  const borderTransportMeansXml = btm.ID
    ? `
    <BorderTransportMeans>
      <ID>${xmlEscape(btm.ID)}</ID>
      <IdentificationTypeCode>${xmlEscape(btm.IdentificationTypeCode || "")}</IdentificationTypeCode>
      <ModeCode>${xmlEscape(btm.ModeCode || "")}</ModeCode>
    </BorderTransportMeans>`
    : "";
  const atm = read(consignment, "ArrivalTransportMeans");
  const arrivalTransportMeansXml = atm.ID
    ? `
        <ArrivalTransportMeans>
          <ID>${xmlEscape(atm.ID)}</ID>
          <IdentificationTypeCode>${xmlEscape(atm.IdentificationTypeCode || "")}</IdentificationTypeCode>
          <ModeCode>${xmlEscape(atm.ModeCode || "")}</ModeCode>
        </ArrivalTransportMeans>`
    : "";
  const buyer = read(gs, "Buyer");
  const buyerXml = buyer.AddressCountryCode
    ? `
      <Buyer>
        <Address>
          <CountryCode>${xmlEscape(buyer.AddressCountryCode)}</CountryCode>
        </Address>
      </Buyer>`
    : "";
  const seller = read(gs, "Seller");
  const sellerXml = seller.AddressCountryCode
    ? `
      <Seller>
        <Address>
          <CountryCode>${xmlEscape(seller.AddressCountryCode)}</CountryCode>
        </Address>
      </Seller>`
    : "";
  // DE 2/5 — CurrencyExchange at Declaration level.
  const currencyExchange = read(d, "CurrencyExchange");
  const currencyExchangeXml = currencyExchange.CurrencyTypeCode
    ? `
    <CurrencyExchange>
      <CurrencyTypeCode>${xmlEscape(currencyExchange.CurrencyTypeCode)}</CurrencyTypeCode>
    </CurrencyExchange>`
    : "";
  // DE 3/39 — AuthorisationHolder at Declaration level.
  const authHolders = asArray(d.AuthorisationHolder);
  const authHolderXml = authHolders
    .filter((ah) => ah.ID && ah.CategoryCode)
    .map((ah) => `
    <AuthorisationHolder>
      <ID>${xmlEscape(ah.ID)}</ID>
      <CategoryCode>${xmlEscape(ah.CategoryCode)}</CategoryCode>
    </AuthorisationHolder>`)
    .join("");
  // DE 8/5 — TransactionNatureCode at GoodsShipment level.
  const transactionNatureCode = text(gs, "TransactionNatureCode");
  const transactionNatureCodeXml = transactionNatureCode
    ? `
      <TransactionNatureCode>${xmlEscape(transactionNatureCode)}</TransactionNatureCode>`
    : "";
  // Full GoodsLocation with Name, TypeCode, Address (DE 5/23).
  const goodsLocation = read(consignment, "GoodsLocation");
  const goodsLocationAddress = read(goodsLocation, "Address");

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(d.FunctionCode)}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(d.FunctionalReferenceID)}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(d.TypeCode)}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(d.GoodsItemQuantity)}</GoodsItemQuantity>
    <DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>
    <InvoiceAmount currencyID="${xmlEscape(read(d, "InvoiceAmount").currencyID)}">${xmlEscape(read(d, "InvoiceAmount").value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>${currencyExchangeXml}${borderTransportMeansXml}
    <Declarant>
      <ID>${xmlEscape(read(d, "Declarant").ID)}</ID>
    </Declarant>${exporterXml}${authHolderXml}
    <GoodsShipment>${transactionNatureCodeXml}${buyerXml}
      <Consignment>
        <ContainerCode>${xmlEscape(consignment.ContainerCode)}</ContainerCode>${arrivalTransportMeansXml}
        <GoodsLocation>
          <Name>${xmlEscape(goodsLocation.Name || "")}</Name>
          <ID>${xmlEscape(goodsLocation.ID || "")}</ID>
          <TypeCode>${xmlEscape(goodsLocation.TypeCode || "A")}</TypeCode>
          <Address>
            <TypeCode>${xmlEscape(goodsLocationAddress.TypeCode || "U")}</TypeCode>
            <CountryCode>${xmlEscape(goodsLocationAddress.CountryCode || "")}</CountryCode>
          </Address>
        </GoodsLocation>
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(read(gs, "Destination").CountryCode)}</CountryCode>
      </Destination>
      <ExportCountry>
        <ID>${xmlEscape(read(gs, "ExportCountry").ID)}</ID>
      </ExportCountry>
      ${asArray(gs.GovernmentAgencyGoodsItem).map((item) => {
        const commodity = read(item, "Commodity");
        const goodsMeasure = read(commodity, "GoodsMeasure");
        const additionalDocuments = asArray(item.AdditionalDocument);
        const additionalDocumentsXml = additionalDocuments
          .map((doc) => `
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(doc?.CategoryCode || "")}</CategoryCode>
          <ID>${xmlEscape(doc?.ID || "")}</ID>
          <TypeCode>${xmlEscape(doc?.TypeCode || "")}</TypeCode>
          ${doc?.StatusCode ? `<LPCOExemptionCode>${xmlEscape(doc.StatusCode)}</LPCOExemptionCode>` : ""}
        </AdditionalDocument>`)
          .join("");
        const classifications = asArray(commodity.Classification);
        const classificationXml = classifications.map((classification) => `
          <Classification>
            <ID>${xmlEscape(classification.ID)}</ID>
            <IdentificationTypeCode>${xmlEscape(classification.IdentificationTypeCode)}</IdentificationTypeCode>
          </Classification>`).join("");
        const procedures = asArray(item.GovernmentProcedure);
        const packaging = asArray(item.Packaging)[0]
          ? asArray(item.Packaging)[0]
          : { SequenceNumeric: "1", MarksNumbersID: "N/A", QuantityQuantity: "1", TypeCode: "PK" };
        const origin = read(item, "Origin");
        const originXml = origin.CountryCode
          ? `\n        <Origin>\n          <CountryCode>${xmlEscape(origin.CountryCode)}</CountryCode>\n          <TypeCode>${xmlEscape(origin.TypeCode || "1")}</TypeCode>\n        </Origin>`
          : "";
        return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(item.SequenceNumeric)}</SequenceNumeric>
        <StatisticalValueAmount currencyID="${xmlEscape(read(item, "StatisticalValueAmount").currencyID)}">${xmlEscape(read(item, "StatisticalValueAmount").value)}</StatisticalValueAmount>
        ${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(commodity.Description || "General goods")}</Description>
          ${classificationXml}
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(goodsMeasure.GrossMassMeasure || 0)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(goodsMeasure.NetNetWeightMeasure || 0)}</NetNetWeightMeasure>
          </GoodsMeasure>${(() => {
            const dutyTaxFee = read(commodity, "DutyTaxFee");
            return dutyTaxFee.DutyRegimeCode
              ? `\n          <DutyTaxFee>\n            <DutyRegimeCode>${xmlEscape(dutyTaxFee.DutyRegimeCode)}</DutyRegimeCode>\n          </DutyTaxFee>`
              : "";
          })()}
        </Commodity>
        <CustomsValuation>
          <MethodCode>${xmlEscape(read(item, "CustomsValuation").MethodCode || "1")}</MethodCode>${(() => {
            const va = read(read(item, "CustomsValuation"), "ValuationAdjustment");
            return va.AdditionCode
              ? `\n          <ValuationAdjustment>\n            <AdditionCode>${xmlEscape(va.AdditionCode)}</AdditionCode>\n          </ValuationAdjustment>`
              : "";
          })()}
        </CustomsValuation>
        ${procedures.map((proc) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(proc.CurrentCode)}</CurrentCode>
          ${proc.PreviousCode ? `<PreviousCode>${xmlEscape(proc.PreviousCode)}</PreviousCode>` : ""}
        </GovernmentProcedure>`).join("")}${originXml}
        <Packaging>
          <SequenceNumeric>${xmlEscape(packaging.SequenceNumeric)}</SequenceNumeric>
          <MarksNumbersID>${xmlEscape(packaging.MarksNumbersID)}</MarksNumbersID>
          <QuantityQuantity>${xmlEscape(packaging.QuantityQuantity)}</QuantityQuantity>
          <TypeCode>${xmlEscape(packaging.TypeCode)}</TypeCode>
        </Packaging>
      </GovernmentAgencyGoodsItem>`;
      }).join("")}
      <Importer>
        <ID>${xmlEscape(read(gs, "Importer").ID)}</ID>
      </Importer>${previousDocumentXml}${sellerXml}
      <TradeTerms>
        <ConditionCode>${xmlEscape(read(gs, "TradeTerms").ConditionCode)}</ConditionCode>
        <LocationID>${xmlEscape(read(gs, "TradeTerms").LocationID)}</LocationID>
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(read(d, "UCR").TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
