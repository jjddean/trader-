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
  // DE 3/1 Exporter — OMIT for all H1 IMA (import) declarations.
  // Including a GB/XI EORI as Exporter on a DE-origin import contradicts
  // ExportCountry.ID → CDS12073/57A + cascading 30A/103 conflicts.
  // Exporter is only required on export (EX*) declarations.
  const exporterXml = "";
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
  // Buyer (16A) and Seller (09B) are Optional (C) for H1. Sending a CountryCode-only
  // Address block triggers CDS12077 R009/R050 (incomplete address combination) and
  // CDS10001 (CityName mandatory when Address is present). Seller at GoodsShipment
  // level also conflicts with Exporter at Declaration level → CDS12073/57A.
  // Omit both until full party data (Name + Address including CityName) is available.
  const buyerXml = "";
  const sellerXml = "";

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
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>${borderTransportMeansXml}
    <Declarant>
      <ID>${xmlEscape(read(d, "Declarant").ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>${buyerXml}
      <Consignment>
        <ContainerCode>${xmlEscape(consignment.ContainerCode)}</ContainerCode>${arrivalTransportMeansXml}
        ${(() => {
          const gl = read(consignment, "GoodsLocation");
          const glAddr = read(gl, "Address");
          const locationName = String(gl.Name || gl.ID || "").trim();
          if (!locationName) return "";
          // XSD sequence: Name → TypeCode → Address(TypeCode → CountryCode)
          // TypeCode (L110) and Address.TypeCode (04A/410) are MANDATORY per CDS10001.
          // CDS12099 for these in earlier rounds was a cascade from wrong Name value.
          // Now Name is correct ("GBAUFXTFXTGW") so TypeCode "A" and Address.TypeCode "U" pass.
          const typeCodeXml = gl.TypeCode ? `<TypeCode>${xmlEscape(gl.TypeCode)}</TypeCode>` : "";
          const addrTypeXml = glAddr.TypeCode ? `<TypeCode>${xmlEscape(glAddr.TypeCode)}</TypeCode>` : "";
          const addrCountryXml = glAddr.CountryCode ? `<CountryCode>${xmlEscape(glAddr.CountryCode)}</CountryCode>` : "";
          const addrXml = (addrTypeXml || addrCountryXml)
            ? `<Address>${addrTypeXml}${addrCountryXml}</Address>`
            : "";
          return `<GoodsLocation><Name>${xmlEscape(locationName)}</Name>${typeCodeXml}${addrXml}</GoodsLocation>`;
        })()}
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
        // DE 4/3 — Duty Regime Code. "100" = standard MFN (third-country) duty rate.
        // Mandatory for H1 IMA: absence triggers CDS12070 cascade across GovernmentProcedure,
        // CustomsValuation, InvoiceLine, and ValuationAdjustment pointers.
        const dutyRegimeCode = String(read(commodity, "DutyTaxFee").DutyRegimeCode || "100");
        // DE 4/14 — Item Charge Amount (invoice line value).
        // Required when CustomsValuation.MethodCode = "1" (Transaction Value).
        const invoiceLineAmt = read(read(commodity, "InvoiceLine"), "ItemChargeAmount");
        const invoiceLineXml = invoiceLineAmt.value
          ? `\n          <InvoiceLine><ItemChargeAmount currencyID="${xmlEscape(String(invoiceLineAmt.currencyID || "GBP"))}">${xmlEscape(invoiceLineAmt.value)}</ItemChargeAmount></InvoiceLine>`
          : "";
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
          <DutyTaxFee>
            <DutyRegimeCode>${xmlEscape(dutyRegimeCode)}</DutyRegimeCode>
          </DutyTaxFee>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(goodsMeasure.GrossMassMeasure || 0)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(goodsMeasure.NetNetWeightMeasure || 0)}</NetNetWeightMeasure>
          </GoodsMeasure>${invoiceLineXml}
        </Commodity>
        <CustomsValuation>
          <MethodCode>${xmlEscape(read(item, "CustomsValuation").MethodCode || "1")}</MethodCode>
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
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(read(d, "UCR").TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
