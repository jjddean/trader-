import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { renderH1Xml, validateXmlPreflight } from "../../src/lib/h1-xml-renderer";

/**
 * The `no_empty_tags` preflight check rejects any element rendered as
 * `<Foo></Foo>`. CDS treats an empty element as a declared-but-blank value and
 * rejects it, so the check exists to catch it locally.
 *
 * These cases pin which optional inputs can produce one.
 */

const EMPTY_TAG = /<([A-Za-z][\w]*)\s*>\s*<\/\1>/;

function lane(overrides: Record<string, unknown> = {}) {
  return {
    _id: "abcdef123456",
    eori: "GB553202734852",
    route: "import",
    declarationType: "A",
    dispatchCountry: "CN",
    destinationCountry: "GB",
    locationId: "GBAULGPLGPLGP1",
    goodsLocationKind: "port",
    transportMode: "1",
    transportId: "CSCLGLOBE",
    transportIdType: "11",
    invoiceCurrency: "GBP",
    presentationOffice: "GBLON004",
    transactionNatureCode: "11",
    exporterName: "Acme",
    exporterCity: "Hamberg",
    exporterLine: "Hafenstrasse",
    exporterPostcode: "20095",
    ...overrides,
  };
}

const items = [
  {
    commodityCode: "8471300000",
    description: "Laptops",
    originCountry: "CN",
    procedureCode: "4000",
    additionalProcedureCode: "000",
    valueAmount: 5500,
    grossWeightKg: 860,
    packageType: "PK",
    packageCount: 220,
    supplementaryUnitQty: 10,
    additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
  },
];

function xmlFor(overrides: Record<string, unknown>) {
  return renderH1Xml(mapToCDS_H1(lane(overrides), items, {}));
}

describe("no_empty_tags — TradeTerms", () => {
  it("omits TradeTerms entirely when no incoterm is set", () => {
    // Regression: TradeTerms used to render unconditionally, so a declaration
    // with no incoterm produced <ConditionCode></ConditionCode> and failed
    // preflight with "no_empty_tags" — naming no field the operator could fix.
    // The submit route now rejects earlier with an explicit DE 4/1 message.
    const xml = xmlFor({ incoterms: "", incotermLocation: "" });
    assert.ok(!xml.includes("<ConditionCode>"), "no empty ConditionCode");
    assert.ok(!xml.includes("<TradeTerms>"), "TradeTerms omitted entirely");
    assert.ok(!EMPTY_TAG.test(xml), "no empty tags anywhere");
    assert.ok(validateXmlPreflight(xml, "GB553202734852").valid);
  });

  it("is clean with an incoterm but no location", () => {
    // Removing the invented GBFELIXSTOWE default must not introduce an empty
    // tag — LocationID is omitted entirely when absent, not rendered blank.
    const xml = xmlFor({ incoterms: "CIF", incotermLocation: "" });
    assert.ok(!xml.includes("<LocationID>"));
    assert.ok(!EMPTY_TAG.test(xml), "unexpected empty tag");
    assert.ok(validateXmlPreflight(xml, "GB553202734852").valid);
  });

  it("is clean with both incoterm and location", () => {
    const xml = xmlFor({ incoterms: "CIF", incotermLocation: "London Gateway" });
    assert.match(xml, /<LocationID>GBLONDONGATEWAY<\/LocationID>/);
    assert.ok(!EMPTY_TAG.test(xml));
  });
});

describe("no_empty_tags — container", () => {
  it("is clean with no container declared", () => {
    const xml = xmlFor({ incoterms: "CIF", incotermLocation: "London Gateway" });
    assert.match(xml, /<ContainerCode>0<\/ContainerCode>/);
    assert.ok(!xml.includes("<TransportEquipment>"));
    assert.ok(!EMPTY_TAG.test(xml));
  });

  it("is clean with a container declared", () => {
    const xml = xmlFor({
      incoterms: "CIF",
      incotermLocation: "London Gateway",
      containerNumber: "TDRY1234567",
    });
    assert.match(xml, /<ContainerCode>1<\/ContainerCode>/);
    assert.match(xml, /<ID>TDRY1234567<\/ID>/);
    assert.ok(!EMPTY_TAG.test(xml));
  });
});
