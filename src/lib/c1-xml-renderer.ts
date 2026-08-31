/**
 * Renders a C1 C&F simplified export payload (from `mapToCDS_C1`) to CDS XML.
 *
 * Element ordering from `docs/hmrc/specs/wco-3.6/WCO_DEC_2_DMS.xsd`. Kept
 * separate from the B1 renderer rather than parameterised: C1 omits
 * TotalGrossMassMeasure (DE 6/5), TotalPackageQuantity (DE 6/18),
 * TransactionNatureCode (DE 8/5), StatisticalValueAmount (DE 8/6),
 * ExportCountry (DE 5/14), CurrencyExchange (DE 4/15) and
 * DepartureTransportMeans (DE 7/7). Emitting any of them empty would trip the
 * no_empty_tags preflight and be rejected by CDS.
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

export function renderC1Xml(payloadInfo: unknown): string {
  const d = read(asRecord(payloadInfo), "Declaration");
  const gs = read(d, "GoodsShipment");
  const consignment = read(gs, "Consignment");
  const declConsignment = read(d, "Consignment");

  const invoice = read(d, "InvoiceAmount");
  const declarationOfficeId = str(d.DeclarationOfficeID);

  const authHolder = read(d, "AuthorisationHolder");
  const authHolderXml = str(authHolder.ID)
    ? `\n    <AuthorisationHolder>\n      <ID>${xmlEscape(str(authHolder.ID))}</ID>${
        str(authHolder.CategoryCode)
          ? `\n      <CategoryCode>${xmlEscape(str(authHolder.CategoryCode))}</CategoryCode>`
          : ""
      }\n    </AuthorisationHolder>`
    : "";

  const btm = read(d, "BorderTransportMeans");
  const btmXml = str(btm.ModeCode)
    ? `\n    <BorderTransportMeans>\n      <ModeCode>${xmlEscape(str(btm.ModeCode))}</ModeCode>\n    </BorderTransportMeans>`
    : "";

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

  const exitOffice = read(d, "ExitOffice");
  const exitOfficeXml = str(exitOffice.ID)
    ? `\n    <ExitOffice>\n      <ID>${xmlEscape(str(exitOffice.ID))}</ID>\n    </ExitOffice>`
    : "";

  const exporterXml = partyXml("Exporter", read(d, "Exporter"), "    ");
  const consigneeXml = partyXml("Consignee", read(gs, "Consignee"), "      ");

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

      const netXml = str(goodsMeasure.NetNetWeightMeasure)
        ? `\n            <NetNetWeightMeasure unitCode="KGM">${xmlEscape(str(goodsMeasure.NetNetWeightMeasure))}</NetNetWeightMeasure>`
        : "";
      const tariffQty = goodsMeasure.TariffQuantity;
      const tariffQtyXml =
        tariffQty != null && str(tariffQty) !== ""
          ? `\n            <TariffQuantity unitCode="${xmlEscape(str(goodsMeasure.TariffQuantityUnitCode) || "NAR")}">${xmlEscape(str(tariffQty))}</TariffQuantity>`
          : "";
      const goodsMeasureXml = netXml || tariffQtyXml
        ? `\n          <GoodsMeasure>${netXml}${tariffQtyXml}\n          </GoodsMeasure>`
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

      return `
      <GovernmentAgencyGoodsItem>
        <SequenceNumeric>${xmlEscape(str(item.SequenceNumeric))}</SequenceNumeric>${additionalDocumentsXml}
        <Commodity>
          <Description>${xmlEscape(str(commodity.Description))}</Description>${classificationXml}${goodsMeasureXml}
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
    <InvoiceAmount currencyID="${xmlEscape(str(invoice.currencyID))}">${xmlEscape(str(invoice.value))}</InvoiceAmount>${authHolderXml}${btmXml}${declConsignmentXml}
    <Declarant>
      <ID>${xmlEscape(str(read(d, "Declarant").ID))}</ID>
    </Declarant>${exitOfficeXml}${exporterXml}
    <GoodsShipment>${consigneeXml}
      <Consignment>
        <ContainerCode>${xmlEscape(str(consignment.ContainerCode))}</ContainerCode>${goodsLocationXml(read(consignment, "GoodsLocation"))}${teXml}
      </Consignment>
      <Destination>
        <CountryCode>${xmlEscape(str(read(gs, "Destination").CountryCode))}</CountryCode>
      </Destination>${itemsXml}${previousDocumentXml}${ucrXml}
    </GoodsShipment>
  </Declaration>
</MetaData>`;
}
