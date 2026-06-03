import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderH1Xml, validateXmlPreflight } from "../../src/lib/h1-xml-renderer";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";

describe("H1 mapper and XML renderer", () => {
  const declaration = {
    _id: "kn7baselineh1sandbox",
    eori: "GB531765313922",
    importerEori: "GB531765313922",
    declarationType: "H1",
    route: "Route 1",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    presentationOffice: "",
    // Source: spec/hmrc-mirror/appendix-16c-felixstowe.md (Appendix 16C ODS 2026-05-18)
    locationId: "GBAUFXTFXTFXT",
    goodsLocationKind: "port",
    invoiceCurrency: "GBP",
    invoiceTotal: 2500,
    incoterms: "CIF",
    incotermLocation: "Felixstowe",
    transportMode: "1",
    transportIdType: "11",
    transportId: "CSCL GLOBE",
  };

  const items = [
    {
      sequenceNumber: 1,
      commodityCode: "6109100010",
      description: "Cotton t-shirts",
      originCountry: "DE",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      valueAmount: 2500,
      valueCurrency: "GBP",
      grossWeightKg: 120,
      netWeightKg: 115,
      shippingMarks: "CARTON-001",
      packageCount: 10,
      packageType: "CT",
      additionalDocuments: [
        { CategoryCode: "N", TypeCode: "935", ID: "INV-2026-0001" },
      ],
    },
  ];

  it("maps saved H1 declaration fields without relying on hidden defaults", () => {
    const payload = mapToCDS_H1(declaration, items);
    const mapped = payload.Declaration;
    const shipment = mapped.GoodsShipment;
    const item = shipment.GovernmentAgencyGoodsItem[0];

    assert.equal(mapped.DeclarationOfficeID, "");
    assert.equal(mapped.InvoiceAmount.currencyID, "GBP");
    assert.equal(mapped.InvoiceAmount.value, "2500.00");
    assert.equal(mapped.BorderTransportMeans.ID, "CSCLGLOBE");
    assert.equal(mapped.BorderTransportMeans.IdentificationTypeCode, "11");
    assert.equal(mapped.BorderTransportMeans.ModeCode, "1");
    assert.equal(shipment.Destination.CountryCode, "GB");
    assert.equal(shipment.ExportCountry.ID, "DE");
    assert.equal(shipment.Importer.ID, "GB531765313922");
    assert.equal(shipment.Consignment.GoodsLocation.ID, "");
    assert.equal(shipment.Consignment.GoodsLocation.Name, "FXTFXTFXT");
    assert.equal(shipment.Consignment.GoodsLocation.TypeCode, "A");
    assert.equal(shipment.Consignment.GoodsLocation.Address.TypeCode, "U");
    assert.equal(shipment.Consignment.GoodsLocation.Address.CountryCode, "GB");
    assert.equal(shipment.Consignment.ArrivalTransportMeans.ID, "CSCLGLOBE");
    assert.equal(shipment.TradeTerms.ConditionCode, "CIF");
    assert.equal(shipment.TradeTerms.LocationID, "GBFELIXSTOWE");
    assert.equal(shipment.TransactionNatureCode, "11");
    assert.deepEqual(item.Commodity.Classification, [
      { ID: "61091000", IdentificationTypeCode: "TSP" },
      { ID: "10", IdentificationTypeCode: "TRC" },
    ]);
    assert.deepEqual(item.GovernmentProcedure, [
      { CurrentCode: "40", PreviousCode: "00" },
      { CurrentCode: "000" },
    ]);
    assert.deepEqual(item.AdditionalInformation, [
      { StatementCode: "00500", StatementDescription: "Importer" },
    ]);
    assert.deepEqual(item.AdditionalDocument, [
      { CategoryCode: "N", TypeCode: "935", ID: "INV-2026-0001", StatusCode: "AC" },
    ]);
  });

  it("renders inspectable WCO XML for the same H1 payload", () => {
    const payload = mapToCDS_H1(declaration, items);
    const xml = renderH1Xml(payload);
    const preflight = validateXmlPreflight(xml, declaration.eori);

    assert.equal(preflight.valid, true);
    assert.match(xml, /<WCODataModelVersionCode>3\.6<\/WCODataModelVersionCode>/);
    assert.match(xml, /<TypeCode>IMA<\/TypeCode>/);
    assert.doesNotMatch(xml, /<DeclarationOfficeID>/);
    // DE 5/15 always mandatory per Group 5 — emit Origin whenever item.originCountry is set.
    assert.match(xml, /<Origin>\s*<CountryCode>DE<\/CountryCode>\s*<TypeCode>1<\/TypeCode>\s*<\/Origin>/);
    assert.match(xml, /<InvoiceAmount currencyID="GBP">2500\.00<\/InvoiceAmount>/);
    assert.match(xml, /<ID>CSCLGLOBE<\/ID>/);
    assert.match(xml, /<GoodsLocation><Name>FXTFXTFXT<\/Name><TypeCode>A<\/TypeCode><Address><TypeCode>U<\/TypeCode><CountryCode>GB<\/CountryCode><\/Address><\/GoodsLocation>/);
    assert.doesNotMatch(xml, /<GoodsLocation>[\s\S]*<ID>FXTFXTFXT<\/ID>/);
    assert.match(xml, /<CountryCode>GB<\/CountryCode>/);
    assert.match(xml, /<ID>DE<\/ID>/);
    assert.match(xml, /<IdentificationTypeCode>TSP<\/IdentificationTypeCode>/);
    assert.match(xml, /<IdentificationTypeCode>TRC<\/IdentificationTypeCode>/);
    assert.match(xml, /<ID>10<\/ID>/);
    assert.match(xml, /<CurrentCode>40<\/CurrentCode>/);
    assert.match(xml, /<PreviousCode>00<\/PreviousCode>/);
    assert.match(xml, /<CurrentCode>000<\/CurrentCode>/);
    assert.match(xml, /<GoodsShipment>\s*<TransactionNatureCode>11<\/TransactionNatureCode>\s*<Consignment>/);
    assert.match(xml, /<TradeTerms>\s*<ConditionCode>CIF<\/ConditionCode>\s*<LocationID>GBFELIXSTOWE<\/LocationID>\s*<\/TradeTerms>/);
    assert.match(
      xml,
      /<AdditionalInformation>\s*<StatementCode>00500<\/StatementCode>\s*<StatementDescription>Importer<\/StatementDescription>\s*<\/AdditionalInformation>/,
    );
    assert.match(xml, /<AdditionalDocument>[\s\S]*<TypeCode>935<\/TypeCode>[\s\S]*<\/AdditionalDocument>\s*<AdditionalInformation>/);
    assert.match(xml, /<CategoryCode>N<\/CategoryCode>/);
    assert.match(xml, /<TypeCode>935<\/TypeCode>/);
    assert.doesNotMatch(xml, /<TypeCode>922<\/TypeCode>/);
  });

  it("emits TariffQuantity (DE 6/2, NAR p/st) when supplementaryUnitQty is set", () => {
    const laptopItems = [
      {
        ...items[0],
        commodityCode: "8471300000",
        description: "Portable automatic data processing machine",
        supplementaryUnitQty: 10,
        supplementaryUnitCode: "NAR",
        packageCount: 1,
        packageType: "PK",
      },
    ];
    const xml = renderH1Xml(mapToCDS_H1(declaration, laptopItems));
    assert.match(xml, /<TariffQuantity unitCode="NAR">10<\/TariffQuantity>/);
  });
});
