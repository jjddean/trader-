import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { buildCC313A, buildCC315A } from "../../src/lib/ens/cc315-builder";
import type { EnsDeclaration } from "../../src/lib/ens/types";

/**
 * Validates generated ENS XML against HMRC's own schemas.
 *
 * HMRC ships complete, compiling XSDs for ENS, so this is real schema
 * validation — not the structural approximation the CDS side has to use in
 * tests/h1/xsd-structure.test.ts. Validation runs through lxml via
 * scripts/ens/validate-xsd.py, because Node has no XSD validator.
 *
 * If Python or lxml is unavailable the suite skips rather than fails: a missing
 * local toolchain is not a defect in the payload. CI has both.
 */

const ROOT = process.cwd();
const VALIDATOR = path.join(ROOT, "scripts/ens/validate-xsd.py");
const SCHEMA_DIR = path.join(ROOT, "docs/hmrc/ens/schemas/declarations");
const CC315A = path.join(SCHEMA_DIR, "CC315A-v11-2.xsd");
const CC313A = path.join(SCHEMA_DIR, "CC313A-v11-2.xsd");

function pythonCommand(): string | null {
  for (const cmd of ["python", "python3", "py"]) {
    const probe = spawnSync(cmd, ["-c", "import lxml"], { encoding: "utf8" });
    if (probe.status === 0) return cmd;
  }
  return null;
}

const PYTHON = pythonCommand();

/** Returns [] when the document validates, otherwise the schema errors. */
function validate(schema: string, xml: string): string[] {
  const run = spawnSync(PYTHON as string, [VALIDATOR, "--stdin", schema], {
    input: xml,
    encoding: "utf8",
  });
  if (run.status === 2) throw new Error(`validator could not run: ${run.stderr}`);
  if (run.status === 0) return [];
  return String(run.stdout || "").trim().split("\n").filter(Boolean);
}

const FIXED = new Date(Date.UTC(2026, 8, 15, 9, 5));
const opts = { messageSender: "GB553202734852/1234567890", messageId: "FCTEST0001", now: FIXED };

/** Mirrors HMRC's validSubmission.xml in shape, with our own values. */
const declaration: EnsDeclaration = {
  localReferenceNumber: "FCENS0001",
  transportModeAtBorder: "4",
  totalGrossMass: 120,
  declarationPlace: "LONDON",
  commercialReferenceNumber: "ABC1234D",
  conveyanceReferenceNumber: "ABC1234D",
  placeOfLoading: "HAMBURG",
  placeOfUnloading: "FELIXSTOWE",
  customsOfficeOfFirstEntry: "GB000060",
  expectedArrivalDateTime: "202609161200",
  consignee: { eori: "GBab12" },
  personLodgingSummaryDeclaration: { eori: "GBCD12345EFG" },
  itinerary: [{ countryCode: "DE" }, { countryCode: "NL" }],
  goodsItems: [
    {
      itemNumber: 1,
      goodsDescription: "Machine parts",
      grossMass: 120,
      commodityCode: "1234",
      documents: [{ documentType: "AB12", reference: "ABCDEF123456" }],
      packages: [{ kindOfPackages: "VR", numberOfPackages: 4, marksAndNumbers: "ACME-1" }],
    },
  ],
};

describe("ENS XSD conformance", { skip: PYTHON ? false : "python with lxml not available" }, () => {
  it("HMRC's own valid examples validate — proves the harness is sound", () => {
    const cases: [string, string][] = [
      [CC315A, "docs/hmrc/ens/examples/new-ens/validSubmission.xml"],
      [CC315A, "docs/hmrc/ens/examples/new-ens/CC315A_reduced.xml"],
      [CC313A, "docs/hmrc/ens/examples/amendment/validAmendment.xml"],
    ];
    for (const [schema, file] of cases) {
      const errors = validate(schema, fs.readFileSync(path.join(ROOT, file), "utf8"));
      assert.deepEqual(errors, [], `${path.basename(file)} should validate`);
    }
  });

  // Guard the guard: the validator must actually reject something.
  it("rejects a document with an element out of sequence", () => {
    const xml = buildCC315A(declaration, opts);
    const lrn = "    <RefNumHEA4>FCENS0001</RefNumHEA4>\n";
    const mode = "    <TraModAtBorHEA76>4</TraModAtBorHEA76>\n";
    assert.ok(xml.includes(lrn) && xml.includes(mode), "fixture shape changed");
    const broken = xml.replace(lrn + mode, mode + lrn);
    assert.notEqual(broken, xml, "swap must actually apply");
    assert.ok(validate(CC315A, broken).length > 0, "reordered elements must fail");
  });

  it("rejects an undeclared element", () => {
    const broken = buildCC315A(declaration, opts).replace(
      "<HEAHEA>",
      "<NotAnIcsElement>x</NotAnIcsElement><HEAHEA>",
    );
    assert.ok(validate(CC315A, broken).length > 0, "unknown elements must fail");
  });

  it("a generated new ENS validates against CC315A", () => {
    assert.deepEqual(validate(CC315A, buildCC315A(declaration, opts)), []);
  });

  it("a minimal new ENS validates", () => {
    const minimal: EnsDeclaration = {
      localReferenceNumber: "FCENS0002",
      transportModeAtBorder: "1",
      customsOfficeOfFirstEntry: "GB000060",
      expectedArrivalDateTime: "202609161200",
      personLodgingSummaryDeclaration: { eori: "GB553202734852" },
      goodsItems: [{ itemNumber: 1 }],
    };
    assert.deepEqual(validate(CC315A, buildCC315A(minimal, opts)), []);
  });

  it("a new ENS with every optional block populated validates", () => {
    const full: EnsDeclaration = {
      ...declaration,
      identityOfMeansOfTransport: "MAERSKESSEX",
      nationalityOfMeansOfTransport: "GB",
      specificCircumstanceIndicator: "A",
      transportChargesMethodOfPayment: "A",
      subsequentEntryOffices: ["GB000061", "GB000062"],
      lodgementCustomsOffice: "GB000060",
      seals: [{ sealIdentity: "SEAL-1" }, { sealIdentity: "SEAL-2" }],
      consignor: {
        name: "Acme GmbH",
        streetAndNumber: "1 Hafenstrasse",
        postcode: "20095",
        city: "Hamburg",
        countryCode: "DE",
        eori: "DE123456789012",
      },
      notifyParty: { name: "FR Notify SA", city: "Calais", countryCode: "FR", eori: "FR123456789012" },
      representative: { name: "Broker Ltd", eori: "GB553202734852" },
      carrier: { name: "Maersk Line", eori: "GB111222333444" },
      goodsItems: [
        {
          itemNumber: 1,
          goodsDescription: "Machine parts",
          grossMass: 120,
          commodityCode: "12345678",
          unDangerousGoodsCode: "1234",
          transportChargesMethodOfPayment: "A",
          commercialReferenceNumber: "REF-1",
          placeOfLoading: "HAMBURG",
          placeOfUnloading: "FELIXSTOWE",
          documents: [{ documentType: "AB12", reference: "ABCDEF123456" }],
          specialMentions: [{ additionalInformationCode: "10600" }],
          packages: [{ kindOfPackages: "VR", numberOfPackages: 4, numberOfPieces: 40, marksAndNumbers: "ACME-1" }],
          containers: [{ containerNumber: "MSKU1234567" }],
          transportIdentities: [{ identity: "MAERSKESSEX", nationality: "GB" }],
          consignor: { name: "Acme GmbH", city: "Hamburg", countryCode: "DE" },
          consignee: { eori: "GBab12" },
          notifyParty: { name: "FR Notify SA", city: "Calais", countryCode: "FR", eori: "FR123456789012" },
        },
        { itemNumber: 2, goodsDescription: "Spare parts", grossMass: 60, packages: [{ kindOfPackages: "BX" }] },
      ],
    };
    assert.deepEqual(validate(CC315A, buildCC315A(full, opts)), []);
  });

  it("a GB-EORI notify party still validates with its address suppressed", () => {
    const xml = buildCC315A(
      { ...declaration, notifyParty: { name: "UK Ltd", city: "Dover", countryCode: "GB", eori: "GB999999999999" } },
      opts,
    );
    assert.ok(!xml.includes("<NamNOTPAR672>"));
    assert.deepEqual(validate(CC315A, xml), []);
  });

  it("a generated amendment validates against CC313A", () => {
    const xml = buildCC313A(
      { ...declaration, movementReferenceNumber: "26GB08I01234567891" },
      { ...opts, mrn: "26GB08I01234567891" },
    );
    assert.deepEqual(validate(CC313A, xml), []);
  });
});
