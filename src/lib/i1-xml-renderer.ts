/**
 * Renders an I1 C&F simplified import payload (from `mapToCDS_I1`) to CDS XML.
 *
 * Element ordering from `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`. The shape
 * follows the H1 renderer where the two categories agree, and omits what
 * Appendix 21F does not carry: ArrivalTransportMeans (DE 7/9),
 * TransactionNatureCode (DE 8/5), StatisticalValueAmount (DE 8/6),
 * CurrencyExchange (DE 4/15), Buyer/Seller (DE 3/24–3/27).
 *
 * Every interpolated value goes through xmlEscape() — no exceptions.
 */

import { xmlEscape } from "./xml-utils";

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function read(source: unknown, key: string): Record<string, any> {
  return asRecord(asRecord(source)[key]);
}

function asArray(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value.map(asRecord);
  if (value && typeof value === "object") return [asRecord(value)];
  return [];
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function goodsLocationXml(gl: Record<string, any>): string {
  const id = str(gl.ID);
  const name = str(gl.Name);
  const typeCode = str(gl.TypeCode);
  const addr = asRecord(gl.Address);
  const addrTypeCode = str(addr.TypeCode);
  const addrCountry = str(addr.CountryCode);
  if (!id && !name && !typeCode && !addrTypeCode && !addrCountry) return "";
  // XSD GoodsLocation sequence: Name → ID → TypeCode → Address.
  const inner = `${name ? `<Name>${xmlEscape(name)}</Name>` : ""}${
    id ? `<ID>${xmlEscape(id)}</ID>` : ""
  }${typeCode ? `<TypeCode>${xmlEscape(typeCode)}</TypeCode>` : ""}${
    addrTypeCode || addrCountry
      ? `<Address>${addrTypeCode ? `<TypeCode>${xmlEscape(addrTypeCode)}</TypeCode>` : ""}${
          addrCountry ? `<CountryCode>${xmlEscape(addrCountry)}</CountryCode>` : ""
        }</Address>`
      : ""
  }`;
  return `\n        <GoodsLocation>${inner}</GoodsLocation>`;
}

export function renderI1Xml(payloadInfo: unknown): string {
  const d = read(asRecord(payloadInfo), "Declaration");
  const gs = read(d, "GoodsShipment");
  const consignment = read(gs, "Consignment");

  const invoice = read(d, "InvoiceAmount");
  const declarationOfficeId = str(d.DeclarationOfficeID);

  const declarationAdditionalDocsXml = asArray(d.AdditionalDocument)
    .map((doc) => {
      const category = str(doc.CategoryCode);
      const docId = str(doc.ID);
      const type = str(doc.TypeCode);
      if (!category || !docId || !type) return "";
      return `
    <AdditionalDocument>
      <CategoryCode>${xmlEscape(category)}</CategoryCode>
      <ID>${xmlEscape(docId)}</ID>
      <TypeCode>${xmlEscape(type)}</TypeCode>
    </AdditionalDocument>`;
    })
    .join("");

  const authHolder = read(d, "AuthorisationHolder");
  // XSD AuthorisationHolder sequence: ID → CategoryCode. Mandatory on I1.
  const authHolderXml = str(authHolder.ID)
    ? `\n    <AuthorisationHolder>\n      <ID>${xmlEscape(str(authHolder.ID))}</ID>${
        str(authHolder.CategoryCode)
          ? `\n      <CategoryCode>${xmlEscape(str(authHolder.CategoryCode))}</CategoryCode>`
          : ""
      }\n    </AuthorisationHolder>`
    : "";

  const btm = read(d, "BorderTransportMeans");
  const btmXml = str(btm.ID) || str(btm.ModeCode)
    ? `\n    <BorderTransportMeans>${
        str(btm.ID) ? `\n      <ID>${xmlEscape(str(btm.ID))}</ID>` : ""
      }${
        str(btm.IdentificationTypeCode)
          ? `\n      <IdentificationTypeCode>${xmlEscape(str(btm.IdentificationTypeCode))}</IdentificationTypeCode>`
          : ""
      }${
        str(btm.ModeCode) ? `\n      <ModeCode>${xmlEscape(str(btm.ModeCode))}</ModeCode>` : ""
      }\n    </BorderTransportMeans>`
    : "";

  const exporter = read(d, "Exporter");
  const exporterAddr = read(exporter, "Address");
  const exporterXml = str(exporter.ID)
    ? `\n    <Exporter>\n      <ID>${xmlEscape(str(exporter.ID))}</ID>\n    </Exporter>`
    : str(exporter.Name) && str(exporterAddr.CityName)
      ? `\n    <Exporter>\n      <Name>${xmlEscape(str(exporter.Name))}</Name>\n      <Address>\n        <CityName>${xmlEscape(str(exporterAddr.CityName))}</CityName>\n        <CountryCode>${xmlEscape(str(exporterAddr.CountryCode))}</CountryCode>\n        <Line>${xmlEscape(str(exporterAddr.Line))}</Line>\n        <PostcodeID>${xmlEscape(str(exporterAddr.PostcodeID))}</PostcodeID>\n      </Address>\n    </Exporter>`
      : "";

  const destination = read(gs, "Destination");
  const destinationXml = str(destination.CountryCode)
    ? `\n      <Destination>\n        <CountryCode>${xmlEscape(str(destination.CountryCode))}</CountryCode>\n      </Destination>`
    : "";

  const exportCountry = read(gs, "ExportCountry");
  const exportCountryXml = str(exportCountry.ID)
    ? `\n      <ExportCountry>\n        <ID>${xmlEscape(str(exportCountry.ID))}</ID>\n      </ExportCountry>`
    : "";

  const importer = read(gs, "Importer");
  const importerXml = str(importer.ID)
    ? `\n      <Importer>\n        <ID>${xmlEscape(str(importer.ID))}</ID>\n      </Importer>`
    : "";

  const tradeTerms = read(gs, "TradeTerms");
  const tradeTermsXml = str(tradeTerms.ConditionCode)
    ? `\n      <TradeTerms>\n        <ConditionCode>${xmlEscape(str(tradeTerms.ConditionCode))}</ConditionCode>\n      </TradeTerms>`
    : "";

  const previousDocumentXml = asArray(gs.PreviousDocument)
    .map(
      (pd) => `
      <PreviousDocument>
        <CategoryCode>${xmlEscape(str(pd.CategoryCode))}</CategoryCode>
        <ID>${xmlEscape(str(pd.ID))}</ID>
        <TypeCode>${xmlEscape(str(pd.TypeCode))}</TypeCode>${
          str(pd.LineNumeric) ? `\n        <LineNumeric>${xmlEscape(str(pd.LineNumeric))}</LineNumeric>` : ""
        }
      </PreviousDocument>`,
    )
    .join("");

  const itemsXml = asArray(gs.GovernmentAgencyGoodsItem)
    .map((item) => {
      const commodity = read(item, "Commodity");
      const goodsMeasure = read(commodity, "GoodsMeasure");

      const additionalDocumentsXml = asArray(item.AdditionalDocument)
        .map((doc) => {
          const category = str(doc.CategoryCode);
          const docId = str(doc.ID);
          const type = str(doc.TypeCode);
          if (!category || !docId || !type) return "";
          return `
        <AdditionalDocument>
          <CategoryCode>${xmlEscape(category)}</CategoryCode>
          <ID>${xmlEscape(docId)}</ID>
          <TypeCode>${xmlEscape(type)}</TypeCode>${
            str(doc.StatusCode)
              ? `\n          <LPCOExemptionCode>${xmlEscape(str(doc.StatusCode))}</LPCOExemptionCode>`
              : ""
          }
        </AdditionalDocument>`;
        })
        .join("");

      const classificationXml = asArray(commodity.Classification)
        .map(
          (c) => `
            <Classification>
              <ID>${xmlEscape(str(c.ID))}</ID>
              <IdentificationTypeCode>${xmlEscape(str(c.IdentificationTypeCode))}</IdentificationTypeCode>
            </Classification>`,
        )
        .join("");

      const dutyTaxFeeXml = asArray(commodity.DutyTaxFee)
        .map((fee) => {
          const typeCode = str(fee.TypeCode);
          if (!typeCode) return "";
          return `
            <DutyTaxFee>
              <TypeCode>${xmlEscape(typeCode)}</TypeCode>${
                str(fee.MethodCode) ? `\n              <MethodCode>${xmlEscape(str(fee.MethodCode))}</MethodCode>` : ""
              }
            </DutyTaxFee>`;
        })
        .join("");

      const netMassXml = str(goodsMeasure.NetNetWeightMeasure)
        ? `\n            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(str(goodsMeasure.NetNetWeightMeasure))}</NetNetWeightMeasure>`
        : "";
      const tariffQty = goodsMeasure.TariffQuantity;
      const tariffQtyXml =
        tariffQty != null && str(tariffQty) !== ""
          ? `\n            <TariffQuantity unitCode="${xmlEscape(str(goodsMeasure.TariffQuantityUnitCode) || "NAR")}">${xmlEscape(str(tariffQty))}</TariffQuantity>`
          : "";

      const proceduresXml = asArray(item.GovernmentProcedure)
        .map(
          (proc) => `
        <GovernmentProcedure>
          <CurrentCode>${xmlEscape(str(proc.CurrentCode))}</CurrentCode>${
            str(proc.PreviousCode) ? `\n          <PreviousCode>${xmlEscape(str(proc.PreviousCode))}</PreviousCode>` : ""
          }
        </GovernmentProcedure>`,
        )
        .join("");

      const origin = read(item, "Origin");
      const originXml = str(origin.CountryCode)
        ? `\n        <Origin>\n          <CountryCode>${xmlEscape(str(origin.CountryCode))}</CountryCode>\n          <TypeCode>${xmlEscape(str(origin.TypeCode) || "1")}</TypeCode>\n        </Origin>`
        : "";

      const packagingXml = asArray(item.Packaging)
        .map(
          (pkg) => `
        <Packaging>
          <SequenceNumeric>${xmlEscape(str(pkg.SequenceNumeric) || "1")}</SequenceNumeric>${
            str(pkg.MarksNumbersID) ? `\n          <MarksNumbersID>${xmlEscape(str(pkg.MarksNumbersID))}</MarksNumbersID>` : ""
          }
          <QuantityQuantity>${xmlEscape(str(pkg.QuantityQuantity))}</QuantityQuantity>${
            str(pkg.TypeCode) ? `\n          <TypeCode>${xmlEscape(str(pkg.TypeCode))}</TypeCode>` : ""
          }
        </Packaging>`,
        )
        .join("");

      // XSD GovernmentAgencyGoodsItem sequence: SequenceNumeric →
      // AdditionalDocument → Commodity → GovernmentProcedure → Origin → Packaging.
      return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(str(item.SequenceNumeric))}</SequenceNumeric>${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(str(commodity.Description))}</Description>${classificationXml}${dutyTaxFeeXml}
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(str(goodsMeasure.GrossMassMeasure))}</GrossMassMeasure>${netMassXml}${tariffQtyXml}
          </GoodsMeasure>
        </Commodity>${proceduresXml}${originXml}${packagingXml}
      </GovernmentAgencyGoodsItem>`;
    })
    .join("");

  const ucr = read(d, "UCR");
  const ucrXml = str(ucr.TraderAssignedReferenceID)
    ? `\n      <UCR>\n        <TraderAssignedReferenceID>${xmlEscape(str(ucr.TraderAssignedReferenceID))}</TraderAssignedReferenceID>\n      </UCR>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaData xmlns="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2">
  <WCODataModelVersionCode>3.6</WCODataModelVersionCode>
  <WCOTypeName>DEC</WCOTypeName>
  <ResponsibleCountryCode>GB</ResponsibleCountryCode>
  <ResponsibleAgencyName>HMRC</ResponsibleAgencyName>
  <AgencyAssignedCustomizationVersionCode>v2.1</AgencyAssignedCustomizationVersionCode>
  <Declaration xmlns="urn:wco:datamodel:WCO:DEC-DMS:2" xmlns:clm63055="urn:un:unece:uncefact:codelist:standard:UNECE:AgencyIdentificationCode:D12B" xmlns:ds="urn:wco:datamodel:WCO:MetaData_DS-DMS:2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:wco:datamodel:WCO:DocumentMetaData-DMS:2 ../DocumentMetaData_2_DMS.xsd ">
    <FunctionCode>${xmlEscape(str(d.FunctionCode))}</FunctionCode>
    <FunctionalReferenceID>${xmlEscape(str(d.FunctionalReferenceID))}</FunctionalReferenceID>
    <TypeCode>${xmlEscape(str(d.TypeCode))}</TypeCode>
    <GoodsItemQuantity>${xmlEscape(str(d.GoodsItemQuantity))}</GoodsItemQuantity>${
      declarationOfficeId ? `\n    <DeclarationOfficeID>${xmlEscape(declarationOfficeId)}</DeclarationOfficeID>` : ""
    }
    <InvoiceAmount currencyID="${xmlEscape(str(invoice.currencyID))}">${xmlEscape(str(invoice.value))}</InvoiceAmount>
    <TotalGrossMassMeasure unitCode="KGM">${xmlEscape(str(d.TotalGrossMassMeasure))}</TotalGrossMassMeasure>
    <TotalPackageQuantity>${xmlEscape(str(d.TotalPackageQuantity))}</TotalPackageQuantity>${declarationAdditionalDocsXml}${authHolderXml}${btmXml}
    <Declarant>
      <ID>${xmlEscape(str(read(d, "Declarant").ID))}</ID>
    </Declarant>${exporterXml}
    <GoodsShipment>
      <Consignment>
        <ContainerCode>${xmlEscape(str(consignment.ContainerCode))}</ContainerCode>${goodsLocationXml(read(consignment, "GoodsLocation"))}
      </Consignment>${destinationXml}${exportCountryXml}${itemsXml}${importerXml}${previousDocumentXml}${tradeTermsXml}${ucrXml}
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
