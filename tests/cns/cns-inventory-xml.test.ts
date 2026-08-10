import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertInventoryFieldsPresent,
  assertNoGoodsPresentation,
  buildInventoryPreviousDocument,
  compareAgainstInventoryFixture,
  normalizeUcn,
  INVENTORY_REFERENCE_TYPE_CODE,
} from "../../src/lib/cns/inventory-xml";
import { mapToCDS_H1 } from "../../src/lib/wco-mapper";
import { renderH1Xml } from "../../src/lib/h1-xml-renderer";

/** Matches CNS EUAT fixture LGP100DPS00100 (TDRY1234567, 220 packages, 860kg). */
const UCN = "LGP100DPS00100";

function laneFixture() {
  return {
    _id: "abcdef123456",
    eori: "GB123456789012",
    route: "import",
    declarationType: "A",
    dispatchCountry: "CN",
    destinationCountry: "GB",
    locationId: "GBAULGPLGPLGP1",
    goodsLocationKind: "port",
    transportMode: "1",
    transportId: "MAERSK ESSEX",
    transportIdType: "11",
    invoiceCurrency: "GBP",
    presentationOffice: "GB000060",
    incoterms: "CIF",
    transactionNatureCode: "1",
    exporterName: "Shanghai Trading Co",
    exporterCity: "Shanghai",
    exporterLine: "1 Export Road",
    exporterPostcode: "200000",
  };
}

function itemsFixture() {
  return [
    {
      commodityCode: "8471300000",
      description: "Portable computers",
      originCountry: "CN",
      procedureCode: "4000",
      additionalProcedureCode: "000",
      valueAmount: 5000,
      grossWeightKg: 860,
      packageType: "CT",
      packageCount: 220,
      supplementaryUnitQty: 10,
      additionalDocuments: [{ CategoryCode: "N", TypeCode: "935", ID: "INV-1" }],
    },
  ];
}

describe("normalizeUcn", () => {
  it("trims and upper-cases", () => {
    assert.equal(normalizeUcn("  lgp100dps00100 "), UCN);
  });

  it("does not alter internal characters", () => {
    assert.equal(normalizeUcn("LGP-100/DPS.00100"), "LGP-100/DPS.00100");
  });

  it("returns empty for nullish input", () => {
    assert.equal(normalizeUcn(undefined), "");
    assert.equal(normalizeUcn(null), "");
  });
});

describe("buildInventoryPreviousDocument", () => {
  it("builds the Z/MCR shape from the spec example", () => {
    assert.deepEqual(buildInventoryPreviousDocument(UCN), {
      CategoryCode: "Z",
      TypeCode: "MCR",
      ID: UCN,
      LineNumeric: "1",
    });
  });

  it("refuses to build without a UCN", () => {
    assert.throws(() => buildInventoryPreviousDocument(""), /without a UCN/i);
  });
});

describe("mapper integration — the inventory reference reaches the XML", () => {
  it("omits the MCR entirely on the direct HMRC route", () => {
    const payload = mapToCDS_H1(laneFixture(), itemsFixture(), {});
    const xml = renderH1Xml(payload);
    assert.ok(!xml.includes(`<TypeCode>${INVENTORY_REFERENCE_TYPE_CODE}</TypeCode>`));
    assert.ok(!xml.includes(UCN));
  });

  it("emits the MCR alongside the DUCR on the CNS route", () => {
    const payload = mapToCDS_H1(laneFixture(), itemsFixture(), { cnsUcn: UCN });
    const xml = renderH1Xml(payload);

    // Both previous documents must survive — the DUCR anchors the 99A pointer
    // chain, the MCR carries the inventory reference.
    assert.ok(xml.includes("<TypeCode>DCR</TypeCode>"), "DUCR still present");
    assert.ok(xml.includes(`<TypeCode>${INVENTORY_REFERENCE_TYPE_CODE}</TypeCode>`), "MCR present");
    assert.ok(xml.includes(`<ID>${UCN}</ID>`), "UCN present");
  });

  it("normalises a lower-case UCN before it reaches the XML", () => {
    const payload = mapToCDS_H1(laneFixture(), itemsFixture(), { cnsUcn: "lgp100dps00100" });
    assert.ok(renderH1Xml(payload).includes(`<ID>${UCN}</ID>`));
  });
});

describe("container declaration (DE 7/2 and 7/10)", () => {
  it("declares ContainerCode 0 and no TransportEquipment when no container is given", () => {
    const xml = renderH1Xml(mapToCDS_H1(laneFixture(), itemsFixture(), {}));
    assert.ok(xml.includes("<ContainerCode>0</ContainerCode>"));
    assert.ok(!xml.includes("<TransportEquipment>"));
  });

  it("flips ContainerCode to 1 and emits the container id when declared", () => {
    // Declaring 0 against a containerised inventory record fails the CNS
    // pre-check — the CSP matches on container number.
    const lane = { ...laneFixture(), containerNumber: "TDRY1234567" };
    const xml = renderH1Xml(mapToCDS_H1(lane, itemsFixture(), { cnsUcn: UCN }));
    assert.ok(xml.includes("<ContainerCode>1</ContainerCode>"));
    assert.ok(xml.includes("<TransportEquipment>"));
    assert.ok(xml.includes("<ID>TDRY1234567</ID>"));
  });

  it("strips whitespace and upper-cases the container id", () => {
    const lane = { ...laneFixture(), containerNumber: " tdry 123 4567 " };
    const xml = renderH1Xml(mapToCDS_H1(lane, itemsFixture(), { cnsUcn: UCN }));
    assert.ok(xml.includes("<ID>TDRY1234567</ID>"));
  });

  it("places TransportEquipment after GoodsLocation, per the WCO sequence", () => {
    const lane = { ...laneFixture(), containerNumber: "TDRY1234567" };
    const xml = renderH1Xml(mapToCDS_H1(lane, itemsFixture(), { cnsUcn: UCN }));
    assert.ok(xml.indexOf("<GoodsLocation>") < xml.indexOf("<TransportEquipment>"));
    assert.ok(xml.indexOf("<TransportEquipment>") < xml.indexOf("</Consignment>"));
  });

  it("keeps ContainerCode before ArrivalTransportMeans", () => {
    const lane = { ...laneFixture(), containerNumber: "TDRY1234567" };
    const xml = renderH1Xml(mapToCDS_H1(lane, itemsFixture(), { cnsUcn: UCN }));
    assert.ok(xml.indexOf("<ContainerCode>") < xml.indexOf("<ArrivalTransportMeans>"));
  });
});

describe("assertInventoryFieldsPresent", () => {
  const xml = renderH1Xml(mapToCDS_H1(laneFixture(), itemsFixture(), { cnsUcn: UCN }));

  it("passes for correctly built inventory-linked XML", () => {
    assert.doesNotThrow(() => assertInventoryFieldsPresent(xml, UCN, "GBAULGPLGPLGP1"));
  });

  it("fails when the UCN is absent from the payload", () => {
    const direct = renderH1Xml(mapToCDS_H1(laneFixture(), itemsFixture(), {}));
    assert.throws(() => assertInventoryFieldsPresent(direct, UCN, "GBAULGPLGPLGP1"), /incomplete/i);
  });

  it("fails when no UCN was supplied at all", () => {
    assert.throws(() => assertInventoryFieldsPresent(xml, "", "GBAULGPLGPLGP1"), /no UCN/i);
  });

  it("fails when the goods location is not the inventory-linked one", () => {
    const elsewhere = renderH1Xml(
      mapToCDS_H1({ ...laneFixture(), locationId: "GBAUFXTFXTFXT" }, itemsFixture(), {
        cnsUcn: UCN,
      }),
    );
    assert.throws(
      () => assertInventoryFieldsPresent(elsewhere, UCN, "GBAULGPLGPLGP1"),
      /goods location/i,
    );
  });
});

describe("assertNoGoodsPresentation", () => {
  it("passes for a normal import declaration", () => {
    const xml = renderH1Xml(mapToCDS_H1(laneFixture(), itemsFixture(), { cnsUcn: UCN }));
    assert.doesNotThrow(() => assertNoGoodsPresentation(xml));
  });

  it("blocks a GPR message before it can reach CNS", () => {
    assert.throws(
      () => assertNoGoodsPresentation("<Declaration><TypeCode>GPR</TypeCode></Declaration>"),
      /CDS12015/,
    );
  });

  it("blocks a namespaced GPR TypeCode", () => {
    assert.throws(
      () => assertNoGoodsPresentation("<ns2:TypeCode>GPR</ns2:TypeCode>"),
      /CDS12015/,
    );
  });

  it("does not confuse an IMA declaration TypeCode for a GPR", () => {
    assert.doesNotThrow(() => assertNoGoodsPresentation("<TypeCode>IMA</TypeCode>"));
  });
});

describe("compareAgainstInventoryFixture", () => {
  const fixture = {
    ucn: UCN,
    containerNumber: "TDRY1234567",
    packageQuantity: 220,
    grossWeightKg: 860,
  };

  it("is silent when the declaration matches the inventory record", () => {
    assert.deepEqual(
      compareAgainstInventoryFixture(
        { containerNumber: "TDRY1234567", packageQuantity: 220, grossWeightKg: 860 },
        fixture,
      ),
      [],
    );
  });

  it("warns on a container mismatch", () => {
    const warnings = compareAgainstInventoryFixture({ containerNumber: "TDRZ1234567" }, fixture);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Container/);
  });

  it("warns on package and weight mismatches", () => {
    const warnings = compareAgainstInventoryFixture(
      { packageQuantity: 219, grossWeightKg: 861 },
      fixture,
    );
    assert.equal(warnings.length, 2);
  });

  it("does not warn on floating point noise in the weight", () => {
    assert.deepEqual(
      compareAgainstInventoryFixture({ grossWeightKg: 860.0000001 }, fixture),
      [],
    );
  });

  it("stays silent about fields the caller did not supply", () => {
    assert.deepEqual(compareAgainstInventoryFixture({}, fixture), []);
  });
});
