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
    exporterName: "Acme Export GmbH",
    exporterCity: "Hamburg",
    exporterLine: "1 Hafenstrasse",
    exporterPostcode: "20095",
    // Source: docs/hmrc/specs/cds-api/mirrors/appendix-16c-felixstowe.md (Appendix 16C ODS 2026-05-18)
    locationId: "GBAUFXTFXTFXT",
    goodsLocationKind: "port",
    invoiceCurrency: "GBP",
    invoiceTotal: 2500,
    incoterms: "CIF",
    incotermLocation: "Felixstowe",
    transactionNatureCode: "11",
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
    assert.match(xml, /<ValuationAdjustment>\s*<AdditionCode>0000<\/AdditionCode>\s*<\/ValuationAdjustment>/);
    assert.match(
      xml,
      /<AdditionalInformation>\s*<StatementCode>00500<\/StatementCode>\s*<StatementDescription>Importer<\/StatementDescription>\s*<\/AdditionalInformation>/,
    );
    assert.match(xml, /<AdditionalDocument>[\s\S]*<TypeCode>935<\/TypeCode>[\s\S]*<\/AdditionalDocument>\s*<AdditionalInformation>/);
    assert.match(xml, /<CategoryCode>N<\/CategoryCode>/);
    assert.match(xml, /<TypeCode>935<\/TypeCode>/);
    assert.doesNotMatch(xml, /<TypeCode>922<\/TypeCode>/);
    assert.doesNotMatch(xml, /<([A-Za-z][\w]*)\s*>\s*<\/\1>/);
  });

  it("defaults StatisticalValueAmount currency to GBP when item valueCurrency is missing", () => {
    const payload = mapToCDS_H1(declaration, [{ ...items[0], valueCurrency: undefined }]);
    const item = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0];
    assert.equal(item.StatisticalValueAmount.currencyID, "GBP");
    assert.equal(item.Commodity.InvoiceLine.ItemChargeAmount.currencyID, "GBP");

    const xml = renderH1Xml(payload);
    assert.match(xml, /<StatisticalValueAmount currencyID="GBP">2500\.00<\/StatisticalValueAmount>/);
    assert.match(xml, /<ItemChargeAmount currencyID="GBP">2500\.00<\/ItemChargeAmount>/);
  });

  it("preflight passes when shipping marks are blank (mapper defaults to N/A)", () => {
    const payload = mapToCDS_H1(declaration, [{ ...items[0], shippingMarks: "" }]);
    const xml = renderH1Xml(payload);
    const preflight = validateXmlPreflight(xml, declaration.eori);

    assert.equal(preflight.valid, true);
    assert.match(xml, /<MarksNumbersID>N\/A<\/MarksNumbersID>/);
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

  it("throws when transaction nature code is missing", () => {
    assert.throws(
      () => mapToCDS_H1({ ...declaration, transactionNatureCode: "" }, items),
      /Missing transaction nature code/,
    );
  });

  it("throws when overseas exporter address is missing", () => {
    assert.throws(
      () => mapToCDS_H1({ ...declaration, exporterName: "" }, items),
      /Missing Exporter name/,
    );
  });

  it("omits ValuationAdjustment for FOB incoterms (CDS12100)", () => {
    const xml = renderH1Xml(mapToCDS_H1({ ...declaration, incoterms: "FOB" }, items));
    assert.doesNotMatch(xml, /<ValuationAdjustment>/);
  });

  it("emits DE 2/6 deferment account and DE 4/8 MOP E when configured", () => {
    const withDeferment = {
      ...declaration,
      paymentMethodCode: "E",
      defermentAccountNumber: "1234567",
    };
    const payload = mapToCDS_H1(withDeferment, items);
    assert.deepEqual(payload.Declaration.AdditionalDocument, [
      { CategoryCode: "1", TypeCode: "DAN", ID: "1234567" },
    ]);
    const item = payload.Declaration.GoodsShipment.GovernmentAgencyGoodsItem[0];
    assert.deepEqual(item.Commodity.DutyTaxFee, [
      { DutyRegimeCode: "100", TypeCode: "A00", MethodCode: "E" },
      { TypeCode: "B00", MethodCode: "E" },
    ]);

    const xml = renderH1Xml(payload);
    assert.match(
      xml,
      /<AdditionalDocument>\s*<CategoryCode>1<\/CategoryCode>\s*<ID>1234567<\/ID>\s*<TypeCode>DAN<\/TypeCode>\s*<\/AdditionalDocument>/,
    );
    assert.match(xml, /<DutyTaxFee>[\s\S]*<TypeCode>A00<\/TypeCode>[\s\S]*<MethodCode>E<\/MethodCode>[\s\S]*<\/DutyTaxFee>/);
    assert.match(xml, /<DutyTaxFee>[\s\S]*<TypeCode>B00<\/TypeCode>[\s\S]*<MethodCode>E<\/MethodCode>[\s\S]*<\/DutyTaxFee>/);
  });

  it("leaves golden lane unchanged when deferment fields are empty", () => {
    const baselineXml = renderH1Xml(mapToCDS_H1(declaration, items));
    assert.doesNotMatch(baselineXml, /<TypeCode>DAN<\/TypeCode>/);
    assert.doesNotMatch(baselineXml, /<MethodCode>E<\/MethodCode>/);
  });

  it("throws when MOP E is set without DAN", () => {
    assert.throws(
      () => mapToCDS_H1({ ...declaration, paymentMethodCode: "E" }, items),
      /Deferment account number/,
    );
  });
});

describe("DE 3/19-3/21 representation", () => {
  const base = {
    _id: "kn7representationh1box",
    eori: "GB531765313922",
    declarationType: "H1",
    route: "Route 1",
    destinationCountry: "GB",
    dispatchCountry: "DE",
    presentationOffice: "",
    exporterName: "Acme Export GmbH",
    exporterCity: "Hamburg",
    exporterLine: "1 Hafenstrasse",
    exporterPostcode: "20095",
    locationId: "GBAUFXTFXTFXT",
    goodsLocationKind: "port",
    invoiceCurrency: "GBP",
    invoiceTotal: 2500,
    incoterms: "CIF",
    incotermLocation: "Felixstowe",
    transactionNatureCode: "11",
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
      packageCount: 10,
      packageType: "CT",
      additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-2026-0001" }],
    },
  ];

  it("self-representation (declarant = importer): AI 00500, no Agent", () => {
    const mapped = mapToCDS_H1({ ...base, importerEori: base.eori }, items).Declaration;
    assert.equal(mapped.Agent, undefined);
    assert.equal(mapped.GoodsShipment.Importer.ID, base.eori);
    const item = mapped.GoodsShipment.GovernmentAgencyGoodsItem[0];
    assert.deepEqual(item.AdditionalInformation, [
      { StatementCode: "00500", StatementDescription: "Importer" },
    ]);
  });

  it("indirect, broker is declarant: DE 3/21 status only, no DE 3/19/3/20, no 00500", () => {
    const mapped = mapToCDS_H1(
      { ...base, representationType: "indirect", importerEori: "GB553202734852" },
      items,
    ).Declaration;
    assert.deepEqual(mapped.Agent, { FunctionCode: "3" });
    assert.equal(mapped.GoodsShipment.Importer.ID, "GB553202734852");
    const item = mapped.GoodsShipment.GovernmentAgencyGoodsItem[0];
    assert.equal(item.AdditionalInformation, undefined);
  });

  it("direct, distinct representative EORI populates DE 3/20", () => {
    const mapped = mapToCDS_H1(
      {
        ...base,
        representationType: "direct",
        importerEori: "GB553202734852",
        representativeEori: "GB999999999991",
      },
      items,
    ).Declaration;
    assert.deepEqual(mapped.Agent, { ID: "GB999999999991", FunctionCode: "2" });
  });

  it("representative EORI equal to declarant collapses to status-only", () => {
    const mapped = mapToCDS_H1(
      {
        ...base,
        representationType: "indirect",
        importerEori: "GB553202734852",
        representativeEori: base.eori,
      },
      items,
    ).Declaration;
    assert.deepEqual(mapped.Agent, { FunctionCode: "3" });
  });

  it("regression: representation never emits the self-rep 00500 even if importer = declarant", () => {
    const mapped = mapToCDS_H1(
      { ...base, representationType: "indirect", importerEori: base.eori },
      items,
    ).Declaration;
    const item = mapped.GoodsShipment.GovernmentAgencyGoodsItem[0];
    assert.equal(item.AdditionalInformation, undefined);
    assert.deepEqual(mapped.Agent, { FunctionCode: "3" });
  });

  it("renders DE 3/21 status-only Agent as valid XML", () => {
    const xml = renderH1Xml(
      mapToCDS_H1(
        { ...base, representationType: "indirect", importerEori: "GB553202734852" },
        items,
      ),
    );
    assert.match(xml, /<Agent>\s*<FunctionCode>3<\/FunctionCode>\s*<\/Agent>/);
    assert.ok(xml.indexOf("<Agent>") < xml.indexOf("<BorderTransportMeans>"));
    assert.ok(xml.indexOf("<Agent>") < xml.indexOf("<Declarant>"));
    assert.doesNotMatch(xml, /<StatementCode>00500<\/StatementCode>/);
    assert.doesNotMatch(xml, /<([A-Za-z][\w]*)\s*>\s*<\/\1>/);
  });
});
