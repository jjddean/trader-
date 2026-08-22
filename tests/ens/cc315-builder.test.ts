import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCC313A,
  buildCC315A,
  formatDatePrep,
  formatDateTime,
  formatDecimal,
  formatTimePrep,
} from "../../src/lib/ens/cc315-builder";
import type { EnsDeclaration } from "../../src/lib/ens/types";

/**
 * Specification: docs/hmrc/ens/IMPLEMENTATION_SPEC.md
 * Schemas:       docs/hmrc/ens/schemas/declarations/
 *
 * XSD conformance is asserted separately in xsd-conformance.test.ts, which
 * validates against HMRC's own schemas. This file covers the mapping itself.
 */

const FIXED = new Date(Date.UTC(2026, 8, 15, 9, 5));

const minimal: EnsDeclaration = {
  localReferenceNumber: "FC-ENS-0001",
  transportModeAtBorder: "4",
  customsOfficeOfFirstEntry: "GB000060",
  expectedArrivalDateTime: "202609161200",
  personLodgingSummaryDeclaration: { eori: "GB553202734852" },
  goodsItems: [
    {
      itemNumber: 1,
      goodsDescription: "Machine parts",
      grossMass: 120,
      packages: [{ kindOfPackages: "BX", numberOfPackages: 4 }],
    },
  ],
};

const opts = { messageSender: "GB553202734852/1234567890", messageId: "FCTEST0001", now: FIXED };

function build(overrides: Partial<EnsDeclaration> = {}) {
  return buildCC315A({ ...minimal, ...overrides }, opts);
}

describe("ENS formatters", () => {
  it("DatePrepType is yyMMdd", () => {
    assert.equal(formatDatePrep(FIXED), "260915");
  });

  it("TimeType is HHmm", () => {
    assert.equal(formatTimePrep(FIXED), "0905");
  });

  it("DateTimeType is exactly 12 characters, yyyyMMddHHmm", () => {
    const v = formatDateTime(FIXED);
    assert.equal(v, "202609150905");
    assert.equal(v.length, 12);
  });

  // Decimal_11_3 — HMRC's own example emits 1.000, not 1.
  it("Decimal_11_3 keeps three fractional digits", () => {
    assert.equal(formatDecimal(1), "1.000");
    assert.equal(formatDecimal(120.5), "120.500");
    assert.equal(formatDecimal(0), "0.000");
  });

  it("Decimal_11_3 rejects negatives and non-numbers", () => {
    assert.equal(formatDecimal(-1), null);
    assert.equal(formatDecimal("abc"), null);
    assert.equal(formatDecimal(undefined), null);
  });
});

describe("buildCC315A — message envelope", () => {
  const xml = build();

  it("declares the CC315A root and namespace", () => {
    assert.ok(xml.includes('<ie:CC315A xmlns:ie="http://ics.dgtaxud.ec/CC315A">'));
    assert.ok(xml.trimEnd().endsWith("</ie:CC315A>"));
  });

  it("writes the message type as CC315A", () => {
    assert.ok(xml.includes("<MesTypMES20>CC315A</MesTypMES20>"));
  });

  it("carries the sender in EORI/branch form", () => {
    assert.ok(xml.includes("<MesSenMES3>GB553202734852/1234567890</MesSenMES3>"));
  });

  it("derives preparation date and time from the build clock", () => {
    assert.ok(xml.includes("<DatOfPreMES9>260915</DatOfPreMES9>"));
    assert.ok(xml.includes("<TimOfPreMES10>0905</TimOfPreMES10>"));
  });

  it("omits CorIdeMES25 when no correlation identifier is supplied", () => {
    assert.ok(!xml.includes("<CorIdeMES25>"));
  });
});

describe("buildCC315A — derived values", () => {
  it("derives the total item count rather than trusting the caller", () => {
    const xml = build({
      totalNumberOfItems: 99,
      goodsItems: [
        { itemNumber: 1, packages: [{ kindOfPackages: "BX", numberOfPackages: 2 }] },
        { itemNumber: 2, packages: [{ kindOfPackages: "CT", numberOfPackages: 3 }] },
      ],
    });
    assert.ok(xml.includes("<TotNumOfIteHEA305>2</TotNumOfIteHEA305>"));
  });

  it("sums package counts across items", () => {
    const xml = build({
      goodsItems: [
        { itemNumber: 1, packages: [{ kindOfPackages: "BX", numberOfPackages: 2 }] },
        { itemNumber: 2, packages: [{ kindOfPackages: "CT", numberOfPackages: 3 }] },
      ],
    });
    assert.ok(xml.includes("<TotNumOfPacHEA306>5</TotNumOfPacHEA306>"));
  });

  it("omits the package total when nothing is countable", () => {
    const xml = build({ goodsItems: [{ itemNumber: 1 }] });
    assert.ok(!xml.includes("<TotNumOfPacHEA306>"));
  });

  it("generates a declaration date-time when none is given", () => {
    assert.ok(build().includes("<DecDatTimHEA114>202609150905</DecDatTimHEA114>"));
  });

  it("passes through a DateTimeType value already in shape", () => {
    const xml = build({ declarationDateTime: "202601020304" });
    assert.ok(xml.includes("<DecDatTimHEA114>202601020304</DecDatTimHEA114>"));
  });

  it("normalises an ISO date-time into DateTimeType", () => {
    const xml = build({ expectedArrivalDateTime: "2026-09-16T12:00:00Z" });
    assert.ok(xml.includes("<ExpDatOfArrFIRENT733>202609161200</ExpDatOfArrFIRENT733>"));
  });
});

describe("buildCC315A — parties", () => {
  it("uses the consignor's own element ids, not a shared set", () => {
    const xml = build({
      consignor: { name: "Acme GmbH", city: "Hamburg", countryCode: "DE", eori: "DE123456789012" },
    });
    assert.ok(xml.includes("<NamCO17>Acme GmbH</NamCO17>"));
    assert.ok(xml.includes("<TINCO159>DE123456789012</TINCO159>"));
  });

  it("uses PLD ids for the person lodging", () => {
    assert.ok(build().includes("<TINPLD1>GB553202734852</TINPLD1>"));
  });

  // Service guide v1.9 — address children must not be sent with a GB EORI.
  it("suppresses notify party address parts when the EORI is GB", () => {
    const xml = build({
      notifyParty: { name: "UK Notify Ltd", city: "Dover", countryCode: "GB", eori: "GB999999999999" },
    });
    assert.ok(xml.includes("<TINNOTPAR671>GB999999999999</TINNOTPAR671>"));
    assert.ok(!xml.includes("<NamNOTPAR672>"), "name must be omitted for a GB EORI notify party");
    assert.ok(!xml.includes("<CitNOTPAR674>"));
  });

  it("keeps notify party address parts for a non-GB EORI", () => {
    const xml = build({
      notifyParty: { name: "FR Notify SA", city: "Calais", countryCode: "FR", eori: "FR123456789012" },
    });
    assert.ok(xml.includes("<NamNOTPAR672>FR Notify SA</NamNOTPAR672>"));
  });

  it("omits a party block entirely when it carries nothing", () => {
    const xml = build({ carrier: {} });
    assert.ok(!xml.includes("<TRACARENT601>"));
  });
});

describe("buildCC315A — goods items", () => {
  it("emits one GOOITEGDS per item", () => {
    const xml = build({ goodsItems: [{ itemNumber: 1 }, { itemNumber: 2 }, { itemNumber: 3 }] });
    assert.equal(xml.split("<GOOITEGDS>").length - 1, 3);
  });

  it("nests the commodity code inside COMCODGODITM", () => {
    const xml = build({ goodsItems: [{ itemNumber: 1, commodityCode: "12345678" }] });
    assert.ok(xml.includes("<COMCODGODITM>"));
    assert.ok(xml.includes("<ComNomCMD1>12345678</ComNomCMD1>"));
  });

  it("uses the long marks element MarNumOfPacGSL21", () => {
    const xml = build({
      goodsItems: [{ itemNumber: 1, packages: [{ kindOfPackages: "BX", marksAndNumbers: "ACME-1" }] }],
    });
    assert.ok(xml.includes("<MarNumOfPacGSL21>ACME-1</MarNumOfPacGSL21>"));
  });

  it("emits nationality before identity inside IDEMEATRAGI970", () => {
    const xml = build({
      goodsItems: [{ itemNumber: 1, transportIdentities: [{ identity: "MAERSK ESSEX", nationality: "GB" }] }],
    });
    const nat = xml.indexOf("<NatIDEMEATRAGI973>");
    const ide = xml.indexOf("<IdeMeaTraGIMEATRA971>");
    assert.ok(nat > -1 && ide > nat, "schema sequence puts nationality first");
  });

  it("drops documents missing a type or reference", () => {
    const xml = build({
      goodsItems: [
        {
          itemNumber: 1,
          documents: [
            { documentType: "N935", reference: "INV-1" },
            { documentType: "", reference: "orphan" } as never,
          ],
        },
      ],
    });
    assert.equal(xml.split("<PRODOCDC2>").length - 1, 1);
  });

  it("formats item gross mass as Decimal_11_3", () => {
    const xml = build({ goodsItems: [{ itemNumber: 1, grossMass: 12 }] });
    assert.ok(xml.includes("<GroMasGDS46>12.000</GroMasGDS46>"));
  });
});

describe("buildCC315A — escaping", () => {
  it("escapes XML metacharacters in every interpolated value", () => {
    const xml = build({
      goodsItems: [{ itemNumber: 1, goodsDescription: 'Bolts & <brackets> "10mm"' }],
    });
    assert.ok(xml.includes("Bolts &amp; &lt;brackets&gt;"));
    assert.ok(!xml.includes("<brackets>"));
  });
});

describe("buildCC313A — amendment", () => {
  const amendment: EnsDeclaration = { ...minimal, movementReferenceNumber: "26GB08I01234567891" };

  it("declares the CC313A root and message type", () => {
    const xml = buildCC313A(amendment, { ...opts, mrn: "26GB08I01234567891" });
    assert.ok(xml.includes('<ie:CC313A xmlns:ie="http://ics.dgtaxud.ec/CC313A">'));
    assert.ok(xml.includes("<MesTypMES20>CC313A</MesTypMES20>"));
  });

  it("writes the MRN into DocNumHEA5", () => {
    const xml = buildCC313A(amendment, { ...opts, mrn: "26GB08I01234567891" });
    assert.ok(xml.includes("<DocNumHEA5>26GB08I01234567891</DocNumHEA5>"));
  });

  // The failure this guard exists to prevent costs a round trip to discover.
  it("refuses a body MRN that differs from the path MRN", () => {
    assert.throws(
      () => buildCC313A(amendment, { ...opts, mrn: "26GB08I09999999999" }),
      /MRN mismatch/,
    );
  });

  it("refuses an amendment with no MRN at all", () => {
    assert.throws(
      () => buildCC313A(minimal, { ...opts, mrn: "26GB08I01234567891" }),
      /requires movementReferenceNumber/,
    );
  });

  it("never writes DocNumHEA5 on a new ENS", () => {
    assert.ok(!buildCC315A(amendment, opts).includes("<DocNumHEA5>"));
  });
});
