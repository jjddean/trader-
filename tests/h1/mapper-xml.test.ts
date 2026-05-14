import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderH1Xml, validateXmlPreflight } from "../../src/lib/h1-xml-renderer";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";

describe("H1 mapper and XML renderer", () => {
  const declaration = {
    _id: "kn7baselineh1sandbox",
    eori: "GB243617410764",
    importerEori: "GB243617410764",
    declarationType: "H1",
    route: "Route 1",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    presentationOffice: "GBLON004",
    locationId: "GBAUFXTFXTGW",
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

    assert.equal(mapped.DeclarationOfficeID, "GBLON004");
    assert.equal(mapped.InvoiceAmount.currencyID, "GBP");
    assert.equal(mapped.InvoiceAmount.value, "2500.00");
    assert.equal(mapped.BorderTransportMeans.ID, "CSCLGLOBE");
    assert.equal(mapped.BorderTransportMeans.IdentificationTypeCode, "11");
    assert.equal(mapped.BorderTransportMeans.ModeCode, "1");
    assert.equal(shipment.Destination.CountryCode, "GB");
    assert.equal(shipment.ExportCountry.ID, "DE");
    assert.equal(shipment.Importer.ID, "GB243617410764");
    assert.equal(shipment.Consignment.GoodsLocation.ID, "GBAUFXTFXTGW");
    assert.equal(shipment.Consignment.ArrivalTransportMeans.ID, "CSCLGLOBE");
    assert.equal(shipment.TradeTerms.ConditionCode, "CIF");
    assert.equal(shipment.TradeTerms.LocationID, "Felixstowe");
    assert.deepEqual(item.Commodity.Classification, [
      { ID: "61091000", IdentificationTypeCode: "TSP" },
      { ID: "10", IdentificationTypeCode: "TRC" },
    ]);
    assert.deepEqual(item.GovernmentProcedure, [
      { CurrentCode: "40", PreviousCode: "00" },
      { CurrentCode: "000" },
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
    assert.match(xml, /<DeclarationOfficeID>GBLON004<\/DeclarationOfficeID>/);
    assert.match(xml, /<InvoiceAmount currencyID="GBP">2500\.00<\/InvoiceAmount>/);
    assert.match(xml, /<ID>CSCLGLOBE<\/ID>/);
    assert.match(xml, /<CountryCode>GB<\/CountryCode>/);
    assert.match(xml, /<ID>DE<\/ID>/);
    assert.match(xml, /<IdentificationTypeCode>TSP<\/IdentificationTypeCode>/);
    assert.match(xml, /<IdentificationTypeCode>TRC<\/IdentificationTypeCode>/);
    assert.match(xml, /<ID>10<\/ID>/);
    assert.match(xml, /<CurrentCode>40<\/CurrentCode>/);
    assert.match(xml, /<PreviousCode>00<\/PreviousCode>/);
    assert.match(xml, /<CurrentCode>000<\/CurrentCode>/);
    assert.match(xml, /<CategoryCode>N<\/CategoryCode>/);
    assert.match(xml, /<TypeCode>935<\/TypeCode>/);
    assert.doesNotMatch(xml, /<TypeCode>922<\/TypeCode>/);
  });
});
