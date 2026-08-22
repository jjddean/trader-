import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  BULK_PACKAGE_KINDS,
  DEFERRED_RULES,
  implementedRuleCodes,
  partyAddressRuleCodes,
  UNPACKED_PACKAGE_KINDS,
  validateEnsBusinessRules,
} from "../../src/lib/ens/ens-rules";
import type { EnsDeclaration } from "../../src/lib/ens/types";

/**
 * Rules: docs/hmrc/ens/validation/business-rules.json (verbatim HMRC)
 *
 * The coverage suite is the important one. Enforcing a subset of HMRC's rules
 * is fine; enforcing a subset while believing it is all of them is not. These
 * tests reconcile the implementation against the published catalogue so the gap
 * stays visible and cannot drift silently.
 */

const CATALOGUE = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "docs/hmrc/ens/validation/business-rules.json"), "utf8"),
) as {
  messages: Record<string, { ruleCount: number; rules: { errorCode: string; scenario: string; contextElement: string }[] }>;
};

const base: EnsDeclaration = {
  localReferenceNumber: "FCENS0001",
  transportModeAtBorder: "4",
  customsOfficeOfFirstEntry: "GB000060",
  personLodgingSummaryDeclaration: { eori: "GB553202734852" },
  // Rule 8164 requires a carrier TIN for modes 1, 4, 8, 10 and 11.
  carrier: { eori: "GB111222333444" },
  // Rule 8207 requires a commodity code when there is no goods description.
  goodsItems: [
    {
      itemNumber: 1,
      goodsDescription: "Machine parts",
      grossMass: 100,
      // Rule 8152 requires marks for ordinary packaging with no SCI declared.
      packages: [{ kindOfPackages: "BX", numberOfPackages: 2, marksAndNumbers: "ACME-1" }],
    },
  ],
  totalNumberOfPackages: 2,
};

function run(overrides: Partial<EnsDeclaration> = {}, opts: { messageSender?: string } = {}) {
  return validateEnsBusinessRules({ ...base, ...overrides }, opts);
}

function codes(overrides: Partial<EnsDeclaration> = {}, opts: { messageSender?: string } = {}) {
  return run(overrides, opts).map((v) => v.errorCode);
}

describe("ENS rule coverage against the published catalogue", () => {
  const published = new Set(CATALOGUE.messages.IE315.rules.map((r) => r.errorCode));
  const implemented = new Set(implementedRuleCodes());
  const deferred = new Set(DEFERRED_RULES.map((r) => r.errorCode));

  it("the catalogue is the one this repo shipped", () => {
    assert.equal(CATALOGUE.messages.IE315.ruleCount, 188);
    assert.equal(CATALOGUE.messages.IE313.ruleCount, 187);
  });

  it("every implemented code exists in the published catalogue", () => {
    const invented = [...implemented].filter((c) => !published.has(c));
    assert.deepEqual(invented, [], "implementation must not invent error codes");
  });

  it("every deferred code exists in the published catalogue", () => {
    const invented = [...deferred].filter((c) => !published.has(c));
    assert.deepEqual(invented, [], "deferral list must not invent error codes");
  });

  it("no code is both implemented and deferred", () => {
    const both = [...implemented].filter((c) => deferred.has(c));
    assert.deepEqual(both, []);
  });

  // Locks the enumeration to HMRC's own list so it cannot drift again.
  it("the party-address enumeration matches HMRC's address family exactly", () => {
    const family = new Set(
      CATALOGUE.messages.IE315.rules
        .filter((r) =>
          /^\[(Name|Street and number|Street name and number|Postal code|City|Country code)\] should be present (if not \( \[TIN\] \)|for a non-GB \[TIN\])\.$/.test(
            r.scenario,
          ),
        )
        .map((r) => r.errorCode),
    );
    const enumerated = new Set(partyAddressRuleCodes());
    assert.deepEqual(
      [...enumerated].filter((c) => !family.has(c)),
      [],
      "enumerated a code HMRC does not list in the address family",
    );
    assert.deepEqual(
      [...family].filter((c) => !enumerated.has(c)),
      [],
      "HMRC lists an address-family code the enumeration misses",
    );
    assert.equal(family.size, 70);
  });

  it("every deferred rule states a reason", () => {
    for (const r of DEFERRED_RULES) {
      assert.ok(r.reason && r.reason.length > 20, `${r.errorCode} needs a real reason`);
    }
  });

  // The acceptance criterion for this phase: every published rule is either
  // enforced or explicitly deferred with a reason. Nothing silently dropped.
  it("accounts for every published rule", () => {
    const unaccounted = [...published].filter((c) => !implemented.has(c) && !deferred.has(c));
    assert.deepEqual(
      unaccounted,
      [],
      `${unaccounted.length} rules neither implemented nor deferred: ${unaccounted.join(", ")}`,
    );
    // Recorded rather than asserted to a number, so this test does not have to
    // be edited every time a rule is implemented.
    console.log(
      `      coverage: ${implemented.size} implemented, ${deferred.size} deferred, ${unaccounted.length} not yet triaged, of ${published.size} published`,
    );
  });
});

describe("8102 — item numbers unique and sequential from 1", () => {
  it("accepts 1,2,3", () => {
    assert.ok(!codes({ goodsItems: [{ itemNumber: 1 }, { itemNumber: 2 }, { itemNumber: 3 }], totalNumberOfPackages: undefined, specificCircumstanceIndicator: "E" }).includes("8102"));
  });

  it("rejects a duplicate item number", () => {
    assert.ok(codes({ goodsItems: [{ itemNumber: 1 }, { itemNumber: 1 }], specificCircumstanceIndicator: "E", totalNumberOfPackages: undefined }).includes("8102"));
  });

  it("rejects numbering that does not start at 1", () => {
    assert.ok(codes({ goodsItems: [{ itemNumber: 2 }], specificCircumstanceIndicator: "E", totalNumberOfPackages: undefined }).includes("8102"));
  });

  it("rejects a gap in the sequence", () => {
    assert.ok(codes({ goodsItems: [{ itemNumber: 1 }, { itemNumber: 3 }], specificCircumstanceIndicator: "E", totalNumberOfPackages: undefined }).includes("8102"));
  });
});

describe("8103 — gross mass conditional presence", () => {
  const noMass = { goodsItems: [{ itemNumber: 1 }], totalNumberOfPackages: undefined };

  it("requires gross mass by default", () => {
    assert.ok(codes(noMass).includes("8103"));
  });

  // The branch a paraphrase would lose.
  it("does not require it when the specific circumstance indicator is E", () => {
    assert.ok(!codes({ ...noMass, specificCircumstanceIndicator: "E" }).includes("8103"));
  });

  it("does not require it when a total gross mass is declared", () => {
    assert.ok(!codes({ ...noMass, totalGrossMass: 500 }).includes("8103"));
  });

  it("does not require it when the item carries its own gross mass", () => {
    assert.ok(!codes({ goodsItems: [{ itemNumber: 1, grossMass: 10 }], totalNumberOfPackages: undefined }).includes("8103"));
  });
});

describe("8107 / 8113 / 8108 / 8115 — transport identity and nationality", () => {
  it("requires identity for mode 1", () => {
    assert.ok(codes({ transportModeAtBorder: "1" }).includes("8107"));
  });

  it("requires identity for mode 8", () => {
    assert.ok(codes({ transportModeAtBorder: "8" }).includes("8107"));
  });

  it("accepts mode 1 with an identity", () => {
    assert.ok(!codes({ transportModeAtBorder: "1", identityOfMeansOfTransport: "MAERSK" }).includes("8107"));
  });

  it("forbids identity for mode 4", () => {
    assert.ok(codes({ transportModeAtBorder: "4", identityOfMeansOfTransport: "BA123" }).includes("8113"));
  });

  it("requires nationality for mode 3 when an identity is present", () => {
    assert.ok(codes({ transportModeAtBorder: "3", identityOfMeansOfTransport: "AB12CDE" }).includes("8108"));
  });

  it("does not require nationality for mode 3 without an identity", () => {
    assert.ok(!codes({ transportModeAtBorder: "3" }).includes("8108"));
  });

  it("forbids nationality when the mode does not allow it", () => {
    assert.ok(codes({ transportModeAtBorder: "4", nationalityOfMeansOfTransport: "GB" }).includes("8115"));
  });

  it("allows nationality for mode 10 with an identity", () => {
    const c = codes({ transportModeAtBorder: "10", identityOfMeansOfTransport: "X", nationalityOfMeansOfTransport: "GB" });
    assert.ok(!c.includes("8115") && !c.includes("8108"));
  });
});

describe("8109 / 8116 / 8117 — package totals", () => {
  it("requires a total when packages exist", () => {
    assert.ok(codes({ totalNumberOfPackages: undefined }).includes("8109"));
  });

  it("forbids a total when no packages exist", () => {
    assert.ok(
      codes({ goodsItems: [{ itemNumber: 1, grossMass: 1 }], totalNumberOfPackages: 3 }).includes("8116"),
    );
  });

  it("checks the total against the sum", () => {
    assert.ok(codes({ totalNumberOfPackages: 99 }).includes("8117"));
    assert.ok(!codes({ totalNumberOfPackages: 2 }).includes("8117"));
  });

  it("counts each bulk package as exactly one", () => {
    const decl = {
      goodsItems: [{ itemNumber: 1, grossMass: 1, packages: [{ kindOfPackages: "VG" }, { kindOfPackages: "VL" }] }],
      totalNumberOfPackages: 2,
    };
    assert.ok(!codes(decl).includes("8117"));
  });

  it("adds pieces to packages in the sum", () => {
    const decl = {
      goodsItems: [{ itemNumber: 1, grossMass: 1, packages: [{ kindOfPackages: "BX", numberOfPackages: 2, numberOfPieces: 3 }] }],
      totalNumberOfPackages: 5,
    };
    assert.ok(!codes(decl).includes("8117"));
  });
});

describe("8149 / 8150 / 8151 — package kind rules", () => {
  const withPkg = (pkg: Record<string, unknown>) => ({
    goodsItems: [{ itemNumber: 1, grossMass: 1, packages: [pkg as never] }],
    totalNumberOfPackages: undefined,
  });

  it("bulk kinds forbid counts", () => {
    assert.ok(codes(withPkg({ kindOfPackages: "VR", numberOfPackages: 1 })).includes("8149"));
    assert.ok(codes(withPkg({ kindOfPackages: "VR", numberOfPieces: 1 })).includes("8149"));
    assert.ok(!codes(withPkg({ kindOfPackages: "VR" })).includes("8149"));
  });

  it("unpacked kinds require pieces and forbid packages", () => {
    assert.ok(codes(withPkg({ kindOfPackages: "NE", numberOfPackages: 1 })).includes("8150"));
    assert.ok(codes(withPkg({ kindOfPackages: "NE" })).includes("8150"));
    assert.ok(!codes(withPkg({ kindOfPackages: "NE", numberOfPieces: 4 })).includes("8150"));
  });

  it("other kinds require packages and forbid pieces", () => {
    assert.ok(codes(withPkg({ kindOfPackages: "BX" })).includes("8151"));
    assert.ok(codes(withPkg({ kindOfPackages: "BX", numberOfPackages: 1, numberOfPieces: 2 })).includes("8151"));
    assert.ok(!codes(withPkg({ kindOfPackages: "BX", numberOfPackages: 1 })).includes("8151"));
  });

  it("uses the code sets HMRC names in the rule text", () => {
    assert.deepEqual([...BULK_PACKAGE_KINDS].sort(), ["VG", "VL", "VO", "VQ", "VR", "VS", "VY"]);
    assert.deepEqual([...UNPACKED_PACKAGE_KINDS].sort(), ["NE", "NF", "NG"]);
  });
});

describe("8206 / 8611 — item counts", () => {
  it("checks the declared item total against reality", () => {
    assert.ok(codes({ totalNumberOfItems: 5 }).includes("8206"));
    assert.ok(!codes({ totalNumberOfItems: 1 }).includes("8206"));
  });

  it("requires at least one goods item", () => {
    assert.ok(codes({ goodsItems: [], totalNumberOfPackages: undefined }).includes("8611"));
  });

  it("caps goods items at 999", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ itemNumber: i + 1, grossMass: 1 }));
    assert.ok(codes({ goodsItems: many, totalNumberOfPackages: undefined, specificCircumstanceIndicator: "E" }).includes("8611"));
  });
});

describe("party address families (8120–8164, 8220–8263)", () => {
  it("requires the address for a non-GB TIN", () => {
    const v = run({ consignor: { eori: "DE123456789012" } });
    const hit = v.find((x) => x.errorCode === "party-address");
    assert.ok(hit, "non-GB TIN with no address must be flagged");
    assert.ok(hit!.message.includes("TRACONCO1"));
    assert.ok(hit!.message.includes("name"));
  });

  it("accepts a non-GB TIN with a complete address", () => {
    const v = run({
      consignor: {
        eori: "DE123456789012",
        name: "Acme GmbH",
        streetAndNumber: "1 Hafenstrasse",
        postcode: "20095",
        city: "Hamburg",
        countryCode: "DE",
      },
    });
    assert.ok(!v.some((x) => x.errorCode === "party-address"));
  });

  it("does not demand an address for a GB TIN", () => {
    const v = run({ consignor: { eori: "GB553202734852" } });
    assert.ok(!v.some((x) => x.errorCode === "party-address"));
  });

  it("names the item-level party that failed", () => {
    const v = run({
      goodsItems: [{ itemNumber: 1, grossMass: 1, consignee: { eori: "FR123456789012" } }],
      totalNumberOfPackages: undefined,
    });
    const hit = v.find((x) => x.errorCode === "party-address");
    assert.ok(hit?.message.includes("GOOITEGDS[1]/TRACONCE2"));
  });
});

describe("4065 — message sender pattern", () => {
  it("accepts EORI/branch form", () => {
    assert.ok(!codes({}, { messageSender: "GB553202734852/1234567890" }).includes("4065"));
  });

  it("rejects a sender with no branch", () => {
    assert.ok(codes({}, { messageSender: "GB553202734852" }).includes("4065"));
  });

  it("rejects a non-numeric branch", () => {
    assert.ok(codes({}, { messageSender: "GB553202734852/ABCDEFGHIJ" }).includes("4065"));
  });

  it("is not checked when no sender is supplied", () => {
    assert.ok(!codes({}).includes("4065"));
  });
});

describe("violation shape", () => {
  it("carries the HMRC code, context and verbatim scenario", () => {
    const v = run({ transportModeAtBorder: "1" }).find((x) => x.errorCode === "8107");
    assert.ok(v);
    assert.equal(v!.contextElement, "/CC315A/HEAHEA");
    assert.ok(v!.scenario.includes("[Identity of means of transport crossing border]"));
    assert.ok(v!.message.length > 0);
  });

  it("a clean declaration produces no violations", () => {
    assert.deepEqual(run(), []);
  });
});

describe("8111 / 8112 / 8152 — specific circumstance indicator", () => {
  it("SCI C (road) is incompatible with maritime, rail, air, inland water and roro", () => {
    for (const mode of ["1", "2", "4", "8", "10", "11"]) {
      assert.ok(
        codes({ specificCircumstanceIndicator: "C", transportModeAtBorder: mode, carrier: { eori: "GB111222333444" } }).includes("8111"),
        `mode ${mode} should be rejected for SCI C`,
      );
    }
  });

  it("SCI C is compatible with mode 3 (road via Channel Tunnel)", () => {
    assert.ok(!codes({ specificCircumstanceIndicator: "C", transportModeAtBorder: "3" }).includes("8111"));
  });

  it("SCI D (rail) is incompatible with everything except mode 2", () => {
    for (const mode of ["1", "3", "4", "8", "10", "11"]) {
      assert.ok(
        codes({ specificCircumstanceIndicator: "D", transportModeAtBorder: mode, carrier: { eori: "GB111222333444" } }).includes("8112"),
        `mode ${mode} should be rejected for SCI D`,
      );
    }
    assert.ok(!codes({ specificCircumstanceIndicator: "D", transportModeAtBorder: "2" }).includes("8112"));
  });

  it("marks are required for ordinary packaging when no SCI is declared", () => {
    const c = codes({
      goodsItems: [{ itemNumber: 1, goodsDescription: "x", grossMass: 1, packages: [{ kindOfPackages: "BX", numberOfPackages: 1 }] }],
      totalNumberOfPackages: 1,
    });
    assert.ok(c.includes("8152"));
  });

  // The ELSE branch: with an SCI present the marks become optional.
  it("marks are optional once an SCI is declared", () => {
    const c = codes({
      specificCircumstanceIndicator: "E",
      goodsItems: [{ itemNumber: 1, goodsDescription: "x", grossMass: 1, packages: [{ kindOfPackages: "BX", numberOfPackages: 1 }] }],
      totalNumberOfPackages: 1,
    });
    assert.ok(!c.includes("8152"));
  });

  it("marks are not required for bulk or unpacked kinds", () => {
    for (const kind of ["VR", "NE"]) {
      const c = codes({
        goodsItems: [{ itemNumber: 1, goodsDescription: "x", grossMass: 1, packages: [{ kindOfPackages: kind, numberOfPieces: 2 }] }],
        totalNumberOfPackages: kind === "VR" ? 1 : 2,
      });
      assert.ok(!c.includes("8152"), `${kind} should not require marks`);
    }
  });
});
