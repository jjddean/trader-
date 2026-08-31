/**
 * Schema value lengths.
 *
 * HMRC validates the payload against the WCO schema before CDS sees it and
 * rejects the whole message on a facet violation:
 *
 *   cvc-maxLength-valid: Value '59000 Lille' with length = '11' is not
 *   facet-valid with respect to maxLength '9' for type
 *   '#AnonType_AddressPostcodeIDType'
 *
 * There is no notification and no MRN, so an over-length value is
 * indistinguishable from silence unless the response body is read.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WCO_MAX_LENGTHS, findOverLengthValues } from "../../src/lib/wco-max-lengths";
import { validateXmlPreflight } from "../../src/lib/h1-xml-renderer";

describe("WCO_MAX_LENGTHS", () => {
  it("carries the limits HMRC enforced in the rejection", () => {
    assert.equal(WCO_MAX_LENGTHS.PostcodeID, 9);
    assert.equal(WCO_MAX_LENGTHS.CityName, 35);
  });

  it("excludes container elements, which hold no text", () => {
    for (const container of ["Address", "Buyer", "Agent", "BorderTransportMeans", "GoodsShipment"]) {
      assert.equal(WCO_MAX_LENGTHS[container], undefined, container);
    }
  });

  it("has a positive limit for every entry", () => {
    for (const [element, max] of Object.entries(WCO_MAX_LENGTHS)) {
      assert.ok(Number.isInteger(max) && max > 0, `${element} = ${max}`);
    }
  });
});

describe("findOverLengthValues", () => {
  it("catches the postcode HMRC rejected", () => {
    const [finding] = findOverLengthValues("<PostcodeID>59000 Lille</PostcodeID>");
    assert.equal(finding.element, "PostcodeID");
    assert.equal(finding.length, 11);
    assert.equal(finding.maxLength, 9);
    assert.equal(finding.value, "59000 Lille");
  });

  it("accepts a value exactly at the limit", () => {
    assert.deepEqual(findOverLengthValues("<PostcodeID>123456789</PostcodeID>"), []);
  });

  it("ignores elements with no published limit", () => {
    assert.deepEqual(findOverLengthValues("<SomethingElse>" + "x".repeat(500) + "</SomethingElse>"), []);
  });

  it("measures the decoded value, not the escaped one", () => {
    // Five characters in the document, one to the schema.
    const xml = "<PostcodeID>" + "&amp;".repeat(5) + "</PostcodeID>";
    assert.deepEqual(findOverLengthValues(xml), []);
  });

  it("does not measure a container by its children", () => {
    assert.deepEqual(
      findOverLengthValues("<Address><PostcodeID>CT17 9TF</PostcodeID></Address>"),
      [],
    );
  });

  it("reports each distinct offender once", () => {
    const xml = `
      <PostcodeID>59000 Lille</PostcodeID>
      <PostcodeID>59000 Lille</PostcodeID>
      <CityName>${"x".repeat(40)}</CityName>`;
    const findings = findOverLengthValues(xml);
    assert.equal(findings.length, 2);
    assert.deepEqual(findings.map((f) => f.element).sort(), ["CityName", "PostcodeID"]);
  });

  it("handles attributes on the element", () => {
    const [finding] = findOverLengthValues('<PostcodeID languageID="EN">59000 Lille</PostcodeID>');
    assert.equal(finding?.maxLength, 9);
  });
});

describe("preflight blocks an over-length value", () => {
  const base = `<MetaData><Declaration><FunctionCode>9</FunctionCode>
    <TypeCode>EXD</TypeCode><ID>GB553202734852</ID>
    <GoodsShipment><PreviousDocument/><AdditionalDocument/>
    <Consignee><Address><PostcodeID>PLACEHOLDER</PostcodeID></Address></Consignee>
    </GoodsShipment></Declaration></MetaData>`;

  it("fails, and names the element, the length and the value", () => {
    const result = validateXmlPreflight(base.replace("PLACEHOLDER", "59000 Lille"), "GB553202734852");
    assert.equal(result.valid, false);
    const message = result.failed.join(" ");
    assert.match(message, /within_schema_lengths/);
    assert.match(message, /PostcodeID is 11 characters, schema allows 9/);
    assert.match(message, /59000 Lille/);
  });

  it("passes the length check when the value fits", () => {
    const result = validateXmlPreflight(base.replace("PLACEHOLDER", "59000"), "GB553202734852");
    assert.ok(!result.failed.some((f) => f.startsWith("within_schema_lengths")));
    assert.deepEqual(result.overLength, []);
  });
});

describe("empty elements", () => {
  /**
   * Removing TotalGrossMassMeasure from the B1 mapper left the renderer
   * emitting `<TotalGrossMassMeasure unitCode="KGM"></TotalGrossMassMeasure>`,
   * which HMRC rejected: "'' is not a valid value for 'decimal'". The
   * preflight's empty-tag check required a tag with no attributes, so it could
   * not see it — and every measure and amount carries one.
   */
  const wrap = (inner: string) =>
    `<MetaData><Declaration><FunctionCode>9</FunctionCode><TypeCode>EXD</TypeCode>
     <ID>GB553202734852</ID>${inner}
     <GoodsShipment><PreviousDocument/><AdditionalDocument/></GoodsShipment>
     </Declaration></MetaData>`;

  it("catches an empty element that carries an attribute", () => {
    const result = validateXmlPreflight(
      wrap('<TotalGrossMassMeasure unitCode="KGM"></TotalGrossMassMeasure>'),
      "GB553202734852",
    );
    assert.ok(result.failed.includes("no_empty_tags"));
  });

  it("still catches an empty element with no attribute", () => {
    const result = validateXmlPreflight(wrap("<TotalPackageQuantity></TotalPackageQuantity>"), "GB553202734852");
    assert.ok(result.failed.includes("no_empty_tags"));
  });

  it("accepts a populated element", () => {
    const result = validateXmlPreflight(
      wrap('<TotalGrossMassMeasure unitCode="KGM">168.000</TotalGrossMassMeasure>'),
      "GB553202734852",
    );
    assert.ok(!result.failed.includes("no_empty_tags"));
  });

  it("accepts a self-closing element", () => {
    const result = validateXmlPreflight(wrap("<PreviousDocument/>"), "GB553202734852");
    assert.ok(!result.failed.includes("no_empty_tags"));
  });
});
