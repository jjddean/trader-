/**
 * Renders a B1 export payload (from `mapToCDS_B1`) to CDS XML.
 *
 * Element ordering is taken from `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`,
 * not from the H1 renderer — the two categories diverge in both which elements
 * exist and where they sit. Declaration children:
 *   … TypeCode, GoodsItemQuantity, DeclarationOfficeID, InvoiceAmount,
 *     TotalGrossMassMeasure, TotalPackageQuantity, AuthorisationHolder,
 *     BorderTransportMeans, Consignment, CurrencyExchange, Declarant,
 *     ExitOffice, Exporter, GoodsShipment
 * GoodsShipment children:
 *   TransactionNatureCode, Consignee, Consignment, Destination, ExportCountry,
 *   GovernmentAgencyGoodsItem, PreviousDocument, UCR
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

function addressXml(addr: Record<string, any>, indent: string): string {
  const city = str(addr.CityName);
  const country = str(addr.CountryCode);
  const line = str(addr.Line);
  const postcode = str(addr.PostcodeID);
  if (!city && !country && !line && !postcode) return "";
  // XSD Address sequence: CityName → CountryCode → Line → PostcodeID.
  return `\n${indent}<Address>${city ? `\n${indent}  <CityName>${xmlEscape(city)}</CityName>` : ""}${
    country ? `\n${indent}  <CountryCode>${xmlEscape(country)}</CountryCode>` : ""
  }${line ? `\n${indent}  <Line>${xmlEscape(line)}</Line>` : ""}${
    postcode ? `\n${indent}  <PostcodeID>${xmlEscape(postcode)}</PostcodeID>` : ""
  }\n${indent}</Address>`;
}

/** Party block with XSD sequence Name → ID → Address. */
function partyXml(tag: string, party: Record<string, any>, indent: string): string {
  const name = str(party.Name);
  const id = str(party.ID);
  const addr = addressXml(asRecord(party.Address), `${indent}  `);
  if (!name && !id && !addr) return "";
  return `\n${indent}<${tag}>${name ? `\n${indent}  <Name>${xmlEscape(name)}</Name>` : ""}${
    id ? `\n${indent}  <ID>${xmlEscape(id)}</ID>` : ""
  }${addr}\n${indent}</${tag}>`;
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

export function renderB1Xml(payloadInfo: unknown): string {
  const d = read(asRecord(payloadInfo), "Declaration");
  const gs = read(d, "GoodsShipment");
  const consignment = read(gs, "Consignment");
  const declConsignment = read(d, "Consignment");

  const invoice = read(d, "InvoiceAmount");
  const declarationOfficeId = str(d.DeclarationOfficeID);

  const authHolder = read(d, "AuthorisationHolder");
  // XSD AuthorisationHolder sequence: ID → CategoryCode.
  const authHolderXml = str(authHolder.ID)
    ? `\n    <AuthorisationHolder>\n      <ID>${xmlEscape(str(authHolder.ID))}</ID>${
        str(authHolder.CategoryCode)
          ? `\n      <CategoryCode>${xmlEscape(str(authHolder.CategoryCode))}</CategoryCode>`
          : ""
      }\n    </AuthorisationHolder>`
    : "";

  const btm = read(d, "BorderTransportMeans");
  // XSD BorderTransportMeans sequence: Name → ID → IdentificationTypeCode →
  // TypeCode → RegistrationNationalityCode → ModeCode.
  const btmXml = str(btm.ID) || str(btm.ModeCode)
    ? `\n    <BorderTransportMeans>${
        str(btm.ID) ? `\n      <ID>${xmlEscape(str(btm.ID))}</ID>` : ""
      }${
        str(btm.IdentificationTypeCode)
          ? `\n      <IdentificationTypeCode>${xmlEscape(str(btm.IdentificationTypeCode))}</IdentificationTypeCode>`
          : ""
      }${
        str(btm.RegistrationNationalityCode)
          ? `\n      <RegistrationNationalityCode>${xmlEscape(str(btm.RegistrationNationalityCode))}</RegistrationNationalityCode>`
          : ""
      }${
        str(btm.ModeCode) ? `\n      <ModeCode>${xmlEscape(str(btm.ModeCode))}</ModeCode>` : ""
      }\n    </BorderTransportMeans>`
    : "";

  // Declaration/Consignment — XSD sequence: Carrier → ConsignmentItem →
  // Consignor → Freight → Itinerary.
  const carrierXml = partyXml("Carrier", read(declConsignment, "Carrier"), "      ");
  const freight = read(declConsignment, "Freight");
  const freightXml = str(freight.PaymentMethodCode)
    ? `\n      <Freight>\n        <PaymentMethodCode>${xmlEscape(str(freight.PaymentMethodCode))}</PaymentMethodCode>\n      </Freight>`
    : "";
  const itineraryXml = asArray(declConsignment.Itinerary)
    .map((leg) =>
      str(leg.RoutingCountryCode)
        ? `\n      <Itinerary>\n        <SequenceNumeric>${xmlEscape(str(leg.SequenceNumeric) || "1")}</SequenceNumeric>\n        <RoutingCountryCode>${xmlEscape(str(leg.RoutingCountryCode))}</RoutingCountryCode>\n      </Itinerary>`
        : "",
    )
    .join("");
  const declConsignmentXml = carrierXml || freightXml || itineraryXml
    ? `\n    <Consignment>${carrierXml}${freightXml}${itineraryXml}\n    </Consignment>`
    : "";

  const currencyExchange = read(d, "CurrencyExchange");
  const currencyExchangeXml = str(currencyExchange.RateNumeric)
    ? `\n    <CurrencyExchange>${
        str(currencyExchange.CurrencyTypeCode)
          ? `\n      <CurrencyTypeCode>${xmlEscape(str(currencyExchange.CurrencyTypeCode))}</CurrencyTypeCode>`
          : ""
      }\n      <RateNumeric>${xmlEscape(str(currencyExchange.RateNumeric))}</RateNumeric>\n    </CurrencyExchange>`
    : "";

  const exitOffice = read(d, "ExitOffice");
  const exitOfficeXml = str(exitOffice.ID)
    ? `\n    <ExitOffice>\n      <ID>${xmlEscape(str(exitOffice.ID))}</ID>\n    </ExitOffice>`
    : "";

  const exporterXml = partyXml("Exporter", read(d, "Exporter"), "    ");
  const consigneeXml = partyXml("Consignee", read(gs, "Consignee"), "      ");

  const dtm = read(consignment, "DepartureTransportMeans");
  // XSD DepartureTransportMeans sequence: Name → ID → IdentificationTypeCode →
  // TypeCode → ModeCode.
  const dtmXml = str(dtm.ID)
    ? `\n        <DepartureTransportMeans>\n          <ID>${xmlEscape(str(dtm.ID))}</ID>${
        str(dtm.IdentificationTypeCode)
          ? `\n          <IdentificationTypeCode>${xmlEscape(str(dtm.IdentificationTypeCode))}</IdentificationTypeCode>`
          : ""
      }${
        str(dtm.ModeCode) ? `\n          <ModeCode>${xmlEscape(str(dtm.ModeCode))}</ModeCode>` : ""
      }\n        </DepartureTransportMeans>`
    : "";

  const te = read(consignment, "TransportEquipment");
  const seal = read(te, "Seal");
  const teXml = str(te.ID) || str(seal.ID)
    ? `\n        <TransportEquipment>\n          <SequenceNumeric>${xmlEscape(str(te.SequenceNumeric) || "1")}</SequenceNumeric>${
        str(te.ID) ? `\n          <ID>${xmlEscape(str(te.ID))}</ID>` : ""
      }${
        str(seal.ID)
          ? `\n          <Seal>\n            <SequenceNumeric>${xmlEscape(str(seal.SequenceNumeric) || "1")}</SequenceNumeric>\n            <ID>${xmlEscape(str(seal.ID))}</ID>\n          </Seal>`
          : ""
      }\n        </TransportEquipment>`
    : "";

  const exportCountry = read(gs, "ExportCountry");
  const exportCountryXml = str(exportCountry.ID)
    ? `\n      <ExportCountry>\n        <ID>${xmlEscape(str(exportCountry.ID))}</ID>\n      </ExportCountry>`
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
      const statValue = read(item, "StatisticalValueAmount");
      const statValueXml = str(statValue.value)
        ? `\n        <StatisticalValueAmount currencyID="${xmlEscape(str(statValue.currencyID) || "GBP")}">${xmlEscape(str(statValue.value))}</StatisticalValueAmount>`
        : "";

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
      // StatisticalValueAmount → AdditionalDocument → Commodity →
      // GovernmentProcedure → Origin → Packaging.
      return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(str(item.SequenceNumeric))}</SequenceNumeric>${statValueXml}${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(str(commodity.Description))}</Description>${classificationXml}
          <GoodsMeasure>
            <GrossMassMeasure unitCode="KGM">${xmlEscape(str(goodsMeasure.GrossMassMeasure))}</GrossMassMeasure>
            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(str(goodsMeasure.NetNetWeightMeasure))}</NetNetWeightMeasure>${tariffQtyXml}
          </GoodsMeasure>
        </Commodity>${proceduresXml}${originXml}${packagingXml}
      </GovernmentAgencyGoodsItem>`;
    })
    .join("");

  const ucr = read(gs, "UCR");
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
    <TotalPackageQuantity>${xmlEscape(str(d.TotalPackageQuantity))}</TotalPackageQuantity>${authHolderXml}${btmXml}${declConsignmentXml}${currencyExchangeXml}
    <Declarant>
      <ID>${xmlEscape(str(read(d, "Declarant").ID))}</ID>
    </Declarant>${exitOfficeXml}${exporterXml}
    <GoodsShipment>
      <TransactionNatureCode>${xmlEscape(str(gs.TransactionNatureCode))}</TransactionNatureCode>${consigneeXml}
      <Consignment>
        <ContainerCode>${xmlEscape(str(consignment.ContainerCode))}</ContainerCode>${dtmXml}${goodsLocationXml(read(consignment, "GoodsLocation"))}${teXml}
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(str(read(gs, "Destination").CountryCode))}</CountryCode>
      </Destination>${exportCountryXml}${itemsXml}${previousDocumentXml}${ucrXml}
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
