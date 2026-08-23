import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allocateFifo,
  checkDischargeDocuments,
  deriveBalance,
  deriveLotStatus,
  isWithinUpdateDeadline,
  MOVEMENT_RULES,
  replayLedger,
  validateDischarge,
  validateMovement,
  type WarehouseMovement,
} from "../../src/lib/warehouse/stock-account";

/**
 * Handbook: docs/hmrc/customs-warehousing/operations/
 * Rules:    docs/hmrc/customs-warehousing/validation/h2-rules.json
 */

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 1, 9, 0);

function receipt(qty = 100, at = T0): WarehouseMovement {
  return { type: "RECEIPT", quantity: qty, occurredAt: at, recordedAt: at };
}

const lot = { quantityEntered: 100 };
const activeWarehouse = { status: "active", ufhApproved: true };

describe("balances are derived from the ledger", () => {
  it("sums the movements", () => {
    assert.equal(deriveBalance(lot, [receipt(100), { type: "DISCHARGE", quantity: -30, occurredAt: T0 + DAY }]), 70);
  });

  it("replays a running balance in occurrence order", () => {
    const out = replayLedger([
      { type: "DISCHARGE", quantity: -20, occurredAt: T0 + 2 * DAY },
      receipt(100),
      { type: "LOSS", quantity: -5, occurredAt: T0 + DAY },
    ]);
    assert.deepEqual(out.balances, [100, 95, 75]);
    assert.equal(out.final, 75);
  });

  it("an empty ledger is a zero balance", () => {
    assert.equal(deriveBalance(lot, []), 0);
  });
});

describe("movement rules follow the handbook", () => {
  it("marks the operations that need supervising office approval", () => {
    for (const t of ["TRANSFER", "USUAL_FORM_OF_HANDLING", "TEMPORARY_REMOVAL", "SAMPLING", "DESTRUCTION"] as const) {
      assert.equal(MOVEMENT_RULES[t].requiresApproval, true, `${t} should need approval`);
    }
  });

  it("marks the operations that do not", () => {
    for (const t of ["RECEIPT", "INTERNAL_MOVE", "RETURN", "DISCHARGE", "ADJUSTMENT"] as const) {
      assert.equal(MOVEMENT_RULES[t].requiresApproval, false, `${t} should not need approval`);
    }
  });

  it("marks which operations discharge the procedure", () => {
    assert.equal(MOVEMENT_RULES.DISCHARGE.discharges, true);
    assert.equal(MOVEMENT_RULES.DESTRUCTION.discharges, true);
    // A temporary removal keeps the goods under procedure.
    assert.equal(MOVEMENT_RULES.TEMPORARY_REMOVAL.discharges, false);
    assert.equal(MOVEMENT_RULES.TRANSFER.discharges, false);
  });

  it("every operation names the handbook section it came from", () => {
    for (const [type, r] of Object.entries(MOVEMENT_RULES)) {
      assert.ok(r.source.startsWith("operations/"), `${type} has no source`);
    }
  });
});

describe("validateMovement", () => {
  const movements = [receipt(100)];

  it("accepts a plain internal move", () => {
    assert.deepEqual(
      validateMovement({
        lot,
        movements,
        proposed: { type: "INTERNAL_MOVE", quantity: 0, occurredAt: T0 + DAY },
        warehouse: activeWarehouse,
      }),
      [],
    );
  });

  it("requires an approval reference where HMRC requires approval", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "DESTRUCTION", quantity: -10, occurredAt: T0 + DAY, reason: "damaged" },
      warehouse: activeWarehouse,
    });
    assert.ok(errs.some((e) => e.includes("approval or prior notification")));
  });

  it("accepts it once the approval reference is present", () => {
    assert.deepEqual(
      validateMovement({
        lot,
        movements,
        proposed: { type: "DESTRUCTION", quantity: -10, occurredAt: T0 + DAY, reason: "damaged", approvalRef: "SO-123" },
        warehouse: activeWarehouse,
      }),
      [],
    );
  });

  it("requires a reason on adjustments and losses", () => {
    for (const t of ["ADJUSTMENT", "LOSS"] as const) {
      const errs = validateMovement({
        lot,
        movements,
        proposed: { type: t, quantity: -5, occurredAt: T0 + DAY },
        warehouse: activeWarehouse,
      });
      assert.ok(errs.some((e) => e.includes("requires a reason")), t);
    }
  });

  it("refuses to remove more than remains under procedure", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "DISCHARGE", quantity: -150, occurredAt: T0 + DAY },
      warehouse: activeWarehouse,
    });
    assert.ok(errs.some((e) => e.includes("only 100 remains")));
  });

  it("insists a stock-reducing movement is negative", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "DISCHARGE", quantity: 10, occurredAt: T0 + DAY },
      warehouse: activeWarehouse,
    });
    assert.ok(errs.some((e) => e.includes("must carry a negative quantity")));
  });

  // The goods stay under the procedure while off site.
  it("refuses a temporary removal that changes the balance", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "TEMPORARY_REMOVAL", quantity: -10, occurredAt: T0 + DAY, reason: "exhibition", approvalRef: "SO-9" },
      warehouse: activeWarehouse,
    });
    assert.ok(errs.some((e) => e.includes("remain under the customs warehousing procedure")));
  });

  it("blocks usual forms of handling when not authorised", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "USUAL_FORM_OF_HANDLING", quantity: 0, occurredAt: T0 + DAY, reason: "repack", approvalRef: "SO-4" },
      warehouse: { status: "active", ufhApproved: false },
    });
    assert.ok(errs.some((e) => e.includes("not authorised for this warehouse")));
  });

  it("blocks every movement when the authorisation is not active", () => {
    const errs = validateMovement({
      lot,
      movements,
      proposed: { type: "INTERNAL_MOVE", quantity: 0, occurredAt: T0 + DAY },
      warehouse: { status: "suspended" },
    });
    assert.ok(errs.some((e) => e.includes("suspended")));
  });
});

describe("the document gate", () => {
  // HMRC's DMS approval condition: the certificate must be available BEFORE
  // release to free circulation.
  it("blocks release to free circulation without the required licence", () => {
    const errs = checkDischargeDocuments(
      { quantityEntered: 100, licenceRequired: true },
      { quantity: 10, dischargeType: "free_circulation" },
    );
    assert.ok(errs.some((e) => e.includes("licence must be produced")));
  });

  it("allows it once the licence is produced", () => {
    assert.deepEqual(
      checkDischargeDocuments(
        { quantityEntered: 100, licenceRequired: true, licenceProducedAt: T0 },
        { quantity: 10, dischargeType: "free_circulation" },
      ),
      [],
    );
  });

  it("blocks release when a preference was claimed but no proof of origin is held", () => {
    const errs = checkDischargeDocuments(
      { quantityEntered: 100, preferenceClaimIntended: true },
      { quantity: 10, dischargeType: "free_circulation" },
    );
    assert.ok(errs.some((e) => e.includes("proof of origin")));
  });

  it("blocks release when a quota is recorded with no supporting certificate", () => {
    const errs = checkDischargeDocuments(
      { quantityEntered: 100, quotaOrderNumber: "090123" },
      { quantity: 10, dischargeType: "free_circulation" },
    );
    assert.ok(errs.some((e) => e.includes("quota order number")));
  });

  // Re-export creates no customs debt and consumes no preference.
  it("does not gate re-export", () => {
    assert.deepEqual(
      checkDischargeDocuments(
        { quantityEntered: 100, licenceRequired: true, preferenceClaimIntended: true, quotaOrderNumber: "090123" },
        { quantity: 10, dischargeType: "re_export" },
      ),
      [],
    );
  });

  it("does not gate destruction or transfer to another procedure", () => {
    for (const t of ["destruction", "other_procedure"] as const) {
      assert.deepEqual(
        checkDischargeDocuments({ quantityEntered: 100, licenceRequired: true }, { quantity: 10, dischargeType: t }),
        [],
        t,
      );
    }
  });
});

describe("validateDischarge", () => {
  const movements = [receipt(100)];

  it("accepts a partial discharge with an acceptance date", () => {
    assert.deepEqual(
      validateDischarge(lot, movements, {
        quantity: 40,
        dischargeType: "free_circulation",
        acceptedAt: T0 + DAY,
      }),
      [],
    );
  });

  // The duty point, not the movement date.
  it("requires the acceptance date on a release to free circulation", () => {
    const errs = validateDischarge(lot, movements, { quantity: 40, dischargeType: "free_circulation" });
    assert.ok(errs.some((e) => e.includes("duty point")));
  });

  it("does not require it for a re-export", () => {
    assert.deepEqual(validateDischarge(lot, movements, { quantity: 40, dischargeType: "re_export" }), []);
  });

  it("refuses more than the balance", () => {
    const errs = validateDischarge(lot, movements, {
      quantity: 200,
      dischargeType: "re_export",
    });
    assert.ok(errs.some((e) => e.includes("only 100 remains")));
  });

  it("refuses a zero or negative quantity", () => {
    assert.ok(validateDischarge(lot, movements, { quantity: 0, dischargeType: "re_export" }).length > 0);
  });

  it("runs the document gate before the quantity check", () => {
    const errs = validateDischarge({ quantityEntered: 100, licenceRequired: true }, movements, {
      quantity: 40,
      dischargeType: "free_circulation",
      acceptedAt: T0,
    });
    assert.ok(errs.some((e) => e.includes("licence")));
  });
});

describe("deriveLotStatus", () => {
  it("is under procedure with the full balance", () => {
    assert.equal(deriveLotStatus(lot, [receipt(100)]), "UNDER_PROCEDURE");
  });

  // One entry, many discharges — the balance stays under procedure.
  it("is partially discharged after a partial removal", () => {
    assert.equal(
      deriveLotStatus(lot, [receipt(100), { type: "DISCHARGE", quantity: -40, occurredAt: T0 + DAY }]),
      "PARTIALLY_DISCHARGED",
    );
  });

  it("is discharged when the balance reaches zero", () => {
    assert.equal(
      deriveLotStatus(lot, [receipt(100), { type: "DISCHARGE", quantity: -100, occurredAt: T0 + DAY }]),
      "DISCHARGED",
    );
  });

  it("is temporarily removed while off site, and back after the return", () => {
    const away = [receipt(100), { type: "TEMPORARY_REMOVAL" as const, quantity: 0, occurredAt: T0 + DAY }];
    assert.equal(deriveLotStatus(lot, away), "TEMPORARILY_REMOVED");
    assert.equal(
      deriveLotStatus(lot, [...away, { type: "RETURN", quantity: 0, occurredAt: T0 + 2 * DAY }]),
      "UNDER_PROCEDURE",
    );
  });
});

describe("stock update deadlines", () => {
  it("real time allows only a moment's processing lag", () => {
    assert.equal(isWithinUpdateDeadline({ ...receipt(), recordedAt: T0 + 30_000 }, "real_time"), true);
    assert.equal(isWithinUpdateDeadline({ ...receipt(), recordedAt: T0 + 2 * 60 * 60 * 1000 }, "real_time"), false);
  });

  // Closing balance: before midnight of the following warehouse operation day.
  it("closing balance allows until midnight of the following day", () => {
    assert.equal(isWithinUpdateDeadline({ ...receipt(), recordedAt: T0 + DAY }, "closing_balance"), true);
    assert.equal(isWithinUpdateDeadline({ ...receipt(), recordedAt: T0 + 3 * DAY }, "closing_balance"), false);
  });
});

describe("FIFO allocation", () => {
  const lots = [
    { enteredAt: T0 + 2 * DAY, quantityRemaining: 50, id: "c" },
    { enteredAt: T0, quantityRemaining: 30, id: "a" },
    { enteredAt: T0 + DAY, quantityRemaining: 40, id: "b" },
  ];

  it("takes the earliest entry first", () => {
    const out = allocateFifo(lots, 50);
    assert.deepEqual(out.map((x) => [x.lot.id, x.take]), [["a", 30], ["b", 20]]);
  });

  it("spans as many lots as needed", () => {
    const out = allocateFifo(lots, 100);
    assert.deepEqual(out.map((x) => [x.lot.id, x.take]), [["a", 30], ["b", 40], ["c", 30]]);
  });

  it("returns nothing when there is not enough stock", () => {
    assert.deepEqual(allocateFifo(lots, 500), []);
  });

  it("skips exhausted lots", () => {
    const out = allocateFifo([{ enteredAt: T0, quantityRemaining: 0, id: "x" }, ...lots], 10);
    assert.deepEqual(out.map((x) => x.lot.id), ["a"]);
  });
});
