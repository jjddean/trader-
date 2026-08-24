import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapToCDS_B1 } from "../../src/lib/b1-mapper";
import { renderB1Xml } from "../../src/lib/b1-xml-renderer";

const declaration: Record<string, unknown> = {
  _id: "b1exportdeclarationrecordid000001",
  route: "export",
  declarationCategory: "B1",
  additionalDeclarationType: "A",
  lrn: "FC-B1TEST01",
  ducr: "6GB553202734852-B1TEST",
  eori: "GB553202734852",
  exporterEori: "GB553202734852",
  destinationCountry: "US",
  dispatchCountry: "GB",
  customsOfficeOfExit: "GB000060",
  presentationOffice: "GB000060",
  locationId: "GBAUFXTFXTFXT",
  goodsLocationKind: "port",
  transportMode: "1",
  transportId: "MAERSK ESSEX",
  transportIdType: "11",
  borderTransportNationality: "GB",
  inlandTransportMode: "3",
  transactionNatureCode: "11",
  invoiceCurrency: "GBP",
  invoiceTotal: 12500,
  consigneeName: "Acme Inc",
  consigneeCity: "Newark",
  consigneeLine: "200 Dock Street",
  consigneePostcode: "07102",
  consigneeCountry: "US",
  carrierName: "Maersk Line",
  carrierEori: "GB111222333444",
  countriesOfRouting: ["FR", "ES"],
  sealNumber: "SEAL-88213",
  containerNumber: "MSKU1234567",
  authorisationHolderEori: "GB553202734852",
  authorisationCategoryCode: "CSE",
  transportChargesMethodOfPayment: "H",
  exchangeRate: "1.27",
};

const items: Record<string, unknown>[] = [
  {
    sequenceNumber: 1,
    commodityCode: "8471300000",
    description: "Portable automatic data processing machine",
    originCountry: "GB",
    procedureCode: "1000",
    additionalProcedureCode: "000",
    valueAmount: 12500,
    statisticalValue: 12500,
    grossWeightKg: 120,
    netWeightKg: 110,
    packageCount: 4,
    packageType: "PK",
    shippingMarks: "ACME-001",
    supplementaryUnitQty: 10,
    supplementaryUnitCode: "NAR",
    additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", StatusCode: "AC", ID: "INV-1" }],
  },
];

const xml = renderB1Xml(mapToCDS_B1(declaration, items));

/**
 * Index of each tag's first occurrence, for XSD sequence assertions.
 * Matches both `<Tag>` and `<Tag attr="…">` — some elements carry unitCode.
 */
function order(...tags: string[]): number[] {
  return tags.map((t) => xml.search(new RegExp(`<${t}[ >]`)));
}

function assertAscending(tags: string[]) {
  const positions = order(...tags);
  positions.forEach((pos, i) => {
    assert.ok(pos > -1, `${tags[i]} missing from rendered XML`);
    if (i > 0) {
      assert.ok(
        pos > positions[i - 1],
        `${tags[i]} must come after ${tags[i - 1]} (WCO_DEC_2_DMS.xsd sequence)`,
      );
    }
  });
}

describe("renderB1Xml — envelope", () => {
  it("renders a WCO 3.6 DEC envelope", () => {
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
    assert.ok(xml.includes("<WCODataModelVersionCode>3.6</WCODataModelVersionCode>"));
    assert.ok(xml.includes("<WCOTypeName>DEC</WCOTypeName>"));
  });

  it("declares TypeCode EXA", () => {
    assert.ok(xml.includes("<TypeCode>EXA</TypeCode>"));
    assert.ok(!xml.includes("<TypeCode>IMA</TypeCode>"));
  });
});

describe("renderB1Xml — export-only data elements", () => {
  it("renders DE 5/12 as ExitOffice", () => {
    assert.ok(xml.includes("<ExitOffice>"));
    assert.ok(xml.includes("<ID>GB000060</ID>"));
  });

  it("renders DE 3/9 Consignee, not Importer", () => {
    assert.ok(xml.includes("<Consignee>"));
    assert.ok(xml.includes("<Name>Acme Inc</Name>"));
    assert.ok(!xml.includes("<Importer>"));
  });

  it("renders DE 7/7 DepartureTransportMeans, not ArrivalTransportMeans", () => {
    assert.ok(xml.includes("<DepartureTransportMeans>"));
    assert.ok(!xml.includes("<ArrivalTransportMeans>"));
  });

  it("renders DE 7/15 nationality on BorderTransportMeans", () => {
    assert.ok(xml.includes("<RegistrationNationalityCode>GB</RegistrationNationalityCode>"));
  });

  it("renders DE 5/18 routing countries", () => {
    assert.ok(xml.includes("<RoutingCountryCode>FR</RoutingCountryCode>"));
    assert.ok(xml.includes("<RoutingCountryCode>ES</RoutingCountryCode>"));
  });

  it("renders DE 7/18 seal", () => {
    assert.ok(xml.includes("<Seal>"));
    assert.ok(xml.includes("<ID>SEAL-88213</ID>"));
  });

  it("renders DE 3/39 authorisation holder", () => {
    assert.ok(xml.includes("<AuthorisationHolder>"));
    assert.ok(xml.includes("<CategoryCode>CSE</CategoryCode>"));
  });

  it("renders DE 4/2 freight payment method and DE 4/15 exchange rate", () => {
    assert.ok(xml.includes("<PaymentMethodCode>H</PaymentMethodCode>"));
    assert.ok(xml.includes("<RateNumeric>1.27</RateNumeric>"));
  });

  it("omits the import valuation and duty blocks", () => {
    assert.ok(!xml.includes("<TradeTerms>"));
    assert.ok(!xml.includes("<CustomsValuation>"));
    assert.ok(!xml.includes("<DutyTaxFee>"));
    assert.ok(!xml.includes("<InvoiceLine>"));
    assert.ok(!xml.includes("<ValuationAdjustment>"));
  });
});

describe("renderB1Xml — XSD element ordering", () => {
  it("orders Declaration children per WCO_DEC_2_DMS.xsd", () => {
    assertAscending([
      "FunctionCode",
      "FunctionalReferenceID",
      "TypeCode",
      "GoodsItemQuantity",
      "DeclarationOfficeID",
      "TotalGrossMassMeasure",
      "TotalPackageQuantity",
      "AuthorisationHolder",
      "BorderTransportMeans",
      "CurrencyExchange",
      "Declarant",
      "ExitOffice",
      "Exporter",
      "GoodsShipment",
    ]);
  });

  it("orders GoodsShipment children per WCO_DEC_2_DMS.xsd", () => {
    assertAscending([
      "TransactionNatureCode",
      "Consignee",
      "Destination",
      "ExportCountry",
      "GovernmentAgencyGoodsItem",
      "PreviousDocument",
    ]);
  });

  it("orders GoodsShipment/Consignment children per WCO_DEC_2_DMS.xsd", () => {
    assertAscending([
      "ContainerCode",
      "DepartureTransportMeans",
      "GoodsLocation",
      "TransportEquipment",
    ]);
  });

  it("orders goods item children per WCO_DEC_2_DMS.xsd", () => {
    assertAscending([
      "SequenceNumeric",
      "AdditionalDocument",
      "Commodity",
      "GovernmentProcedure",
      "Origin",
      "Packaging",
    ]);
  });
});

describe("renderB1Xml — escaping", () => {
  it("escapes XML metacharacters in every interpolated value", () => {
    const hostile = renderB1Xml(
      mapToCDS_B1(
        { ...declaration, consigneeName: 'Ampersand & <Co> "Ltd"' },
        items,
      ),
    );
    assert.ok(hostile.includes("Ampersand &amp; &lt;Co&gt;"));
    assert.ok(!hostile.includes("<Co>"));
  });
});
