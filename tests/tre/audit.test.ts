import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantDeclarationMrnLinks } from "../../convex/lib/tre_links";
import { parseAcceptanceDate } from "../../convex/tre_audit";

describe("TRE audit helpers", () => {
  it("parses ambiguous dates as UK day/month/year", () => {
    const date = parseAcceptanceDate("01/02/2026");

    assert.ok(date);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 1);
    assert.equal(date.getDate(), 1);
  });

  it("rejects impossible UK dates", () => {
    assert.equal(parseAcceptanceDate("31/02/2026"), null);
  });

  it("builds MRN links only from the supplied tenant-scoped declarations", () => {
    const links = buildTenantDeclarationMrnLinks([
      { _id: "declaration-in-active-org", mrn: " 26GB123 " },
      { _id: "declaration-without-mrn" },
    ]);

    assert.deepEqual([...links], [["26GB123", "declaration-in-active-org"]]);
  });
});
