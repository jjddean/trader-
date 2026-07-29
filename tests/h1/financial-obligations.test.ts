import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFinancialObligationDrafts, financialRecordRowsFromObligations } from "../../convex/lib/financial_obligations";

describe("financial obligations", () => {
  it("returns null for draft or missing MRN", () => {
    assert.equal(
      buildFinancialObligationDrafts({
        declarationStatus: "Draft",
        mrn: "26GB84O67R9H5DRAR4",
        financialSource: "derived",
        dutyAmount: 10,
        vatAmount: 20,
        derivedDutyAmount: 10,
        derivedVatAmount: 20,
      }),
      null,
    );
    assert.equal(
      buildFinancialObligationDrafts({
        declarationStatus: "Accepted",
        mrn: "",
        financialSource: "derived",
        dutyAmount: 10,
        vatAmount: 20,
        derivedDutyAmount: 10,
        derivedVatAmount: 20,
      }),
      null,
    );
  });

  it("builds estimated derived duty and vat rows", () => {
    const drafts = buildFinancialObligationDrafts({
      declarationStatus: "Accepted",
      mrn: "26GB84O67R9H5DRAR4",
      financialSource: "derived",
      dutyAmount: 100,
      vatAmount: 200,
      derivedDutyAmount: 100,
      derivedVatAmount: 200,
    });
    assert.ok(drafts);
    assert.equal(drafts.length, 2);
    assert.deepEqual(
      drafts.map((d) => d.obligationType),
      ["duty_a00", "vat_b00"],
    );
    assert.ok(drafts.every((d) => d.authority === "derived" && d.status === "estimated"));
  });

  it("marks hmrc_confirmed as hmrc authority with estimate snapshot when different", () => {
    const drafts = buildFinancialObligationDrafts({
      declarationStatus: "Accepted",
      mrn: "26GB84O67R9H5DRAR4",
      financialSource: "hmrc_confirmed",
      dutyAmount: 90,
      vatAmount: 180,
      derivedDutyAmount: 100,
      derivedVatAmount: 200,
      dmstaxUpdatedAt: 1_700_000_000_000,
    });
    assert.ok(drafts);
    const duty = drafts.find((d) => d.obligationType === "duty_a00");
    assert.ok(duty);
    assert.equal(duty.authority, "hmrc");
    assert.equal(duty.status, "confirmed");
    assert.equal(duty.amount, 90);
    assert.equal(duty.estimateAmount, 100);
    assert.equal(duty.confirmedAt, 1_700_000_000_000);
  });

  it("omits zero-amount obligation types", () => {
    const drafts = buildFinancialObligationDrafts({
      declarationStatus: "Accepted",
      mrn: "26GB84O67R9H5DRAR4",
      financialSource: "derived",
      dutyAmount: 0,
      vatAmount: 50,
      derivedDutyAmount: 0,
      derivedVatAmount: 50,
    });
    assert.ok(drafts);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]?.obligationType, "vat_b00");
  });

  it("maps stored obligations to financial record rows", () => {
    const rows = financialRecordRowsFromObligations(
      {
        _id: "decl123",
        mrn: "26GB84O67R9H5DRAR4",
        created: Date.UTC(2026, 6, 24),
        transactionNatureCode: "11",
      },
      [
        { obligationType: "vat_b00", amount: 200, authority: "derived" },
        { obligationType: "duty_a00", amount: 100, authority: "hmrc" },
      ],
      { label: "Deferment (DE 4/8 E)", accountNumber: "1234567" },
      5000,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.type, "Duty (A00)");
    assert.equal(rows[0]?.isAuthoritative, true);
    assert.equal(rows[1]?.type, "Import VAT (B00)");
    assert.equal(rows[1]?.isAuthoritative, false);
    assert.equal(rows[0]?.accountNumber, "1234567");
  });
});
