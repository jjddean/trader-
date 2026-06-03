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
  const goodsLocation = read(consignment, "GoodsLocation");
  const goodsLocationAddress = read(goodsLocation, "Address");

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
        goodsLocationId: text(goodsLocation, "ID"),
        goodsLocationName: text(goodsLocation, "Name"),
        goodsLocationTypeCode: text(goodsLocation, "TypeCode"),
        goodsLocationAddressTypeCode: text(goodsLocationAddress, "TypeCode"),
        goodsLocationCountryCode: text(goodsLocationAddress, "CountryCode"),
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
      additionalInformation: asArray(item.AdditionalInformation),
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
  // DE 3/1 Exporter — required for imports from non-GB/XI countries.
  // Foreign exporters must be declared by Name+Address (never GB/XI EORI on an overseas import).
  // Omitting the Exporter entirely on a non-GB import triggers CDS12073/57A + 30A/103 cascade
  // because ExportCountry.ID and Origin.CountryCode both reference the foreign country at different
  // hierarchy levels without a unifying Exporter declaration.
  const exporterData = read(d, "Exporter");
  const exporterEoriId = String(exporterData.ID || "").trim();
  const exporterName = String(exporterData.Name || "").trim();
  const exporterAddr = read(exporterData, "Address");
  const exporterAddrCountry = String(exporterAddr.CountryCode || "").trim();
  let exporterXml = "";
  if (exporterEoriId) {
    exporterXml = `\n    <Exporter>\n      <ID>${xmlEscape(exporterEoriId)}</ID>\n    </Exporter>`;
  } else if (exporterName || exporterAddrCountry) {
    // XSD sequence: CityName → CountryCode → Line → PostcodeID (all mandatory when Address present).
    exporterXml = `\n    <Exporter>\n      <Name>${xmlEscape(exporterName || "Exporter")}</Name>\n      <Address>\n        <CityName>${xmlEscape(String(exporterAddr.CityName || ""))}</CityName>\n        <CountryCode>${xmlEscape(exporterAddrCountry)}</CountryCode>\n        <Line>${xmlEscape(String(exporterAddr.Line || ""))}</Line>\n        <PostcodeID>${xmlEscape(String(exporterAddr.PostcodeID || ""))}</PostcodeID>\n      </Address>\n    </Exporter>`;
  }
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
  // DE 8/5 — WCOID 103 at 67A (cds_wco_references.ts). Mapper always sets default "11".
  // XSD GoodsShipment sequence: TransactionNatureCode before Consignment (WCO_DEC_2_DMS.xsd).
  const transactionNatureCode = String(gs.TransactionNatureCode || "").trim();
  const transactionNatureXml = transactionNatureCode
    ? `\n      <TransactionNatureCode>${xmlEscape(transactionNatureCode)}</TransactionNatureCode>`
    : "";

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
    ${String(d.DeclarationOfficeID || "").trim() ? `<DeclarationOfficeID>${xmlEscape(d.DeclarationOfficeID)}</DeclarationOfficeID>\n    ` : ""}<InvoiceAmount currencyID="${xmlEscape(read(d, "InvoiceAmount").currencyID)}">${xmlEscape(read(d, "InvoiceAmount").value)}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(d.TotalGrossMassMeasure)}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(d.TotalPackageQuantity)}</TotalPackageQuantity>${borderTransportMeansXml}
    <Declarant>
      <ID>${xmlEscape(read(d, "Declarant").ID)}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>${buyerXml}${transactionNatureXml}
      <Consignment>
        <ContainerCode>${xmlEscape(consignment.ContainerCode)}</ContainerCode>${arrivalTransportMeansXml}
        ${(() => {
          // DE 5/23 split shape — INFERENCE revised 2026-05-28 10:30.
          // HMRC XSD validator (BAD_REQUEST 2026-05-27 evening) confirmed:
          //   "Invalid content was found starting with element 'CountryCode'.
          //    One of '{Address}' is expected."
          // So CountryCode at GoodsLocation root is NOT in the WCO XSD.
          // DMSREJ 2026-05-31 then showed ID was being treated as the optional
          // additional identifier; the coded location belongs in Name.
          const gl = read(consignment, "GoodsLocation");
          const id = String(gl.ID || "").trim();
          const name = String(gl.Name || "").trim();
          const typeCode = String(gl.TypeCode || "").trim();
          const addr = asRecord(gl.Address);
          const addrTypeCode = String(addr.TypeCode || "").trim();
          const addrCountry = String(addr.CountryCode || "").trim();
          if (!id && !name && !typeCode && !addrTypeCode && !addrCountry) return "";
          const idXml = id ? `<ID>${xmlEscape(id)}</ID>` : "";
          const nameXml = name ? `<Name>${xmlEscape(name)}</Name>` : "";
          const typeXml = typeCode ? `<TypeCode>${xmlEscape(typeCode)}</TypeCode>` : "";
          const addressXml = (addrTypeCode || addrCountry)
            ? `<Address>${addrTypeCode ? `<TypeCode>${xmlEscape(addrTypeCode)}</TypeCode>` : ""}${addrCountry ? `<CountryCode>${xmlEscape(addrCountry)}</CountryCode>` : ""}</Address>`
            : "";
          return `<GoodsLocation>${idXml}${nameXml}${typeXml}${addressXml}</GoodsLocation>`;
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
        const tariffQty = goodsMeasure.TariffQuantity;
        const tariffQtyXml =
          tariffQty != null && String(tariffQty).trim() !== ""
            ? `\n            <TariffQuantity unitCode="${xmlEscape(String(goodsMeasure.TariffQuantityUnitCode || "NAR"))}">${xmlEscape(tariffQty)}</TariffQuantity>`
            : "";
        const additionalInformation = asArray(item.AdditionalInformation);
        const additionalInformationXml = additionalInformation
          .map((ai) => `
        <AdditionalInformation>
          <StatementCode>${xmlEscape(ai.StatementCode || "")}</StatementCode>${ai.StatementDescription ? `\n          <StatementDescription>${xmlEscape(ai.StatementDescription)}</StatementDescription>` : ""}${ai.StatementTypeCode ? `\n          <StatementTypeCode>${xmlEscape(ai.StatementTypeCode)}</StatementTypeCode>` : ""}
        </AdditionalInformation>`)
          .join("");
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
        ${additionalInformationXml}
        <Commodity>
          <Description>${xmlEscape(commodity.Description || "General goods")}</Description>
          ${classificationXml}
          <DutyTaxFee>
            <DutyRegimeCode>${xmlEscape(dutyRegimeCode)}</DutyRegimeCode>
            <TypeCode>A00</TypeCode>
          </DutyTaxFee>
          <DutyTaxFee>
            <TypeCode>B00</TypeCode>
          </DutyTaxFee>
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(goodsMeasure.GrossMassMeasure || 0)}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(goodsMeasure.NetNetWeightMeasure || 0)}</NetNetWeightMeasure>${tariffQtyXml}
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
        <ValuationAdjustment>
          <AdditionCode>0000</AdditionCode>
        </ValuationAdjustment>
      </GovernmentAgencyGoodsItem>`;
      }).join("")}
      <Importer>
        <ID>${xmlEscape(read(gs, "Importer").ID)}</ID>
      </Importer>${previousDocumentXml}${sellerXml}
      <TradeTerms>
        <ConditionCode>${xmlEscape(read(gs, "TradeTerms").ConditionCode)}</ConditionCode>${String(read(gs, "TradeTerms").LocationID || "").trim() ? `\n        <LocationID>${xmlEscape(read(gs, "TradeTerms").LocationID)}</LocationID>` : ""}
      </TradeTerms>
      <UCR>
        <TraderAssignedReferenceID>${xmlEscape(read(d, "UCR").TraderAssignedReferenceID)}</TraderAssignedReferenceID>
      </UCR>
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
