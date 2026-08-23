/**
 * Receipt of goods into a customs warehouse — phase E.
 *
 * Each test names the HMRC rule or handbook sentence it holds in place, so a
 * failure says which obligation broke rather than which function changed.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  ARRIVAL_WORKING_DAYS,
  DISCREPANCY_NOTIFICATION_DAYS,
  ENTRY_TRANSITIONS,
  addWorkingDays,
  arrivalDeadline,
  assertTransition,
  canTransition,
  classifyReceipt,
  discrepancyDeadline,
  isDiscrepancyNotificationLate,
  isReceiptOverdue,
  obligationWarnings,
  planOvershipment,
  planUndershipment,
  quantityToAdmit,
  receiptOutcome,
  statusAfterReceipt,
  validateReceipt,
  type DeclaredLine,
  type WarehouseEntryStatus,
} from "../../src/lib/warehouse/receipt";

/** 2026-08-24 is a Monday, so weekend handling is exercised by construction. */
const MONDAY = Date.UTC(2026, 7, 24, 9, 0, 0);
const DAY = 86_400_000;

describe("entry state machine", () => {
  it("follows the handbook lifecycle from draft to received", () => {
    const path: WarehouseEntryStatus[] = [
      "DRAFT",
      "H2_SUBMITTED",
      "CDS_ACCEPTED",
      "RELEASED_TO_WAREHOUSING",
      "AWAITING_RECEIPT",
      "RECEIVED",
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} → ${path[i + 1]}`);
    }
  });

  it("reaches DISCREPANCY from both AWAITING_RECEIPT and RECEIVED", () => {
    // A shortage is often found at a later stock check, not at the door.
    assert.equal(canTransition("AWAITING_RECEIPT", "DISCREPANCY"), true);
    assert.equal(canTransition("RECEIVED", "DISCREPANCY"), true);
  });

  it("returns a resolved discrepancy to RECEIVED", () => {
    assert.equal(canTransition("DISCREPANCY", "RECEIVED"), true);
  });

  it("rejects only from H2_SUBMITTED, and REJECTED is terminal", () => {
    assert.equal(canTransition("H2_SUBMITTED", "REJECTED"), true);
    assert.equal(canTransition("CDS_ACCEPTED", "REJECTED"), false);
    assert.deepEqual(ENTRY_TRANSITIONS.REJECTED, []);
  });

  it("will not skip clearance to receive goods", () => {
    assert.equal(canTransition("DRAFT", "RECEIVED"), false);
    assert.equal(canTransition("H2_SUBMITTED", "RECEIVED"), false);
    assert.equal(canTransition("CDS_ACCEPTED", "RECEIVED"), false);
  });

  it("names both states when a transition is refused", () => {
    const errors = assertTransition("DRAFT", "RECEIVED");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /DRAFT/);
    assert.match(errors[0], /RECEIVED/);
  });

  it("returns no error for a permitted transition", () => {
    assert.deepEqual(assertTransition("AWAITING_RECEIPT", "RECEIVED"), []);
  });
});

describe("CW-ARRIVAL-5-DAYS — the arrival clock", () => {
  it("counts five working days, not five calendar days", () => {
    // Monday + 5 working days is the following Monday: 7 calendar days.
    assert.equal(arrivalDeadline(MONDAY), MONDAY + 7 * DAY);
  });

  it("skips the weekend", () => {
    const friday = Date.UTC(2026, 7, 28, 9, 0, 0);
    assert.equal(new Date(friday).getUTCDay(), 5);
    // Friday + 1 working day is Monday.
    assert.equal(addWorkingDays(friday, 1), friday + 3 * DAY);
  });

  it("never lands on a Saturday or Sunday", () => {
    for (let offset = 0; offset < 14; offset += 1) {
      for (let days = 1; days <= 5; days += 1) {
        const day = new Date(addWorkingDays(MONDAY + offset * DAY, days)).getUTCDay();
        assert.notEqual(day, 0);
        assert.notEqual(day, 6);
      }
    }
  });

  it("uses the five-day expectation from the handbook", () => {
    assert.equal(ARRIVAL_WORKING_DAYS, 5);
  });

  it("is not overdue when the goods arrive inside the window", () => {
    assert.equal(
      isReceiptOverdue({ releasedAt: MONDAY, receivedAt: MONDAY + 3 * DAY }),
      false,
    );
  });

  it("is overdue when the goods arrive after the window", () => {
    assert.equal(
      isReceiptOverdue({ releasedAt: MONDAY, receivedAt: MONDAY + 10 * DAY }),
      true,
    );
  });

  it("measures an unreceived entry against now", () => {
    assert.equal(isReceiptOverdue({ releasedAt: MONDAY }, MONDAY + 10 * DAY), true);
    assert.equal(isReceiptOverdue({ releasedAt: MONDAY }, MONDAY + 2 * DAY), false);
  });

  it("cannot be overdue before the declaration is cleared", () => {
    // The clock starts at clearance, so an entry with no release date has none.
    assert.equal(isReceiptOverdue({}, MONDAY + 365 * DAY), false);
  });
});

describe("CW-UNDERSHIPMENT-14-DAYS — the notification clock", () => {
  it("runs fourteen calendar days from the date of entry", () => {
    assert.equal(DISCREPANCY_NOTIFICATION_DAYS, 14);
    assert.equal(discrepancyDeadline(MONDAY), MONDAY + 14 * DAY);
  });

  it("runs from entry, not from receipt", () => {
    // The two clocks start at different moments; conflating them would give a
    // deadline that moves when the goods happen to turn up.
    const enteredAt = MONDAY;
    const receivedAt = MONDAY + 6 * DAY;
    assert.equal(discrepancyDeadline(enteredAt), enteredAt + 14 * DAY);
    assert.notEqual(discrepancyDeadline(enteredAt), receivedAt + 14 * DAY);
  });

  it("accepts a notification inside the window", () => {
    assert.equal(isDiscrepancyNotificationLate(MONDAY, MONDAY + 13 * DAY), false);
  });

  it("flags a notification after the window", () => {
    assert.equal(isDiscrepancyNotificationLate(MONDAY, MONDAY + 15 * DAY), true);
  });
});

describe("classifying a receipt", () => {
  const declared: DeclaredLine[] = [
    { itemNumber: 1, declaredQuantity: 100 },
    { itemNumber: 2, declaredQuantity: 50 },
  ];

  it("matches when the goods equal the declaration", () => {
    const lines = classifyReceipt(declared, [
      { itemNumber: 1, receivedQuantity: 100 },
      { itemNumber: 2, receivedQuantity: 50 },
    ]);
    assert.equal(receiptOutcome(lines), "MATCHED");
    assert.deepEqual(
      lines.map((l) => l.variance),
      [0, 0],
    );
  });

  it("detects a shortage", () => {
    const lines = classifyReceipt(declared, [
      { itemNumber: 1, receivedQuantity: 90 },
      { itemNumber: 2, receivedQuantity: 50 },
    ]);
    assert.equal(lines[0].outcome, "UNDER_SHIPMENT");
    assert.equal(lines[0].variance, -10);
    assert.equal(receiptOutcome(lines), "UNDER_SHIPMENT");
  });

  it("detects an excess", () => {
    const lines = classifyReceipt(declared, [
      { itemNumber: 1, receivedQuantity: 120 },
      { itemNumber: 2, receivedQuantity: 50 },
    ]);
    assert.equal(lines[0].outcome, "OVER_SHIPMENT");
    assert.equal(lines[0].variance, 20);
  });

  it("treats a wholly missing line as a shortage, not an absence", () => {
    const lines = classifyReceipt(declared, [{ itemNumber: 1, receivedQuantity: 100 }]);
    assert.equal(lines[1].receivedQuantity, 0);
    assert.equal(lines[1].outcome, "UNDER_SHIPMENT");
  });

  it("compares line by line, so one entry can be short and over at once", () => {
    const lines = classifyReceipt(declared, [
      { itemNumber: 1, receivedQuantity: 80 },
      { itemNumber: 2, receivedQuantity: 60 },
    ]);
    assert.equal(lines[0].outcome, "UNDER_SHIPMENT");
    assert.equal(lines[1].outcome, "OVER_SHIPMENT");
  });

  it("reports the excess first when an entry is both short and over", () => {
    // Excess goods are dutiable, so they are the finding that needs a decision.
    const lines = classifyReceipt(declared, [
      { itemNumber: 1, receivedQuantity: 80 },
      { itemNumber: 2, receivedQuantity: 60 },
    ]);
    assert.equal(receiptOutcome(lines), "OVER_SHIPMENT");
  });
});

describe("CW-OVERSHIPMENT — the excess never inflates the stock lot", () => {
  it("admits only the declared quantity when more arrives", () => {
    const [line] = classifyReceipt(
      [{ itemNumber: 1, declaredQuantity: 100 }],
      [{ itemNumber: 1, receivedQuantity: 130 }],
    );
    // Goods enter the procedure by being declared to it. Crediting 130 would
    // put 30 units under duty suspension that were never declared.
    assert.equal(quantityToAdmit(line), 100);
  });

  it("admits the received quantity when fewer arrive", () => {
    const [line] = classifyReceipt(
      [{ itemNumber: 1, declaredQuantity: 100 }],
      [{ itemNumber: 1, receivedQuantity: 90 }],
    );
    assert.equal(quantityToAdmit(line), 90);
  });

  it("never amends the original entry, whichever flow is chosen", () => {
    for (const intent of ["warehouse_the_excess", "release_to_free_circulation"] as const) {
      assert.equal(planOvershipment(30, intent, MONDAY).amendOriginalEntry, false);
    }
  });

  it("warehousing the excess needs notification, provisional storage and evidence", () => {
    const plan = planOvershipment(30, "warehouse_the_excess", MONDAY);
    assert.equal(plan.requiresSupervisingOfficeNotification, true);
    assert.equal(plan.storeProvisionally, true);
    assert.equal(plan.notificationDeadline, MONDAY + 14 * DAY);
    assert.equal(plan.requiredEvidence.length, 2);
    assert.match(plan.requiredEvidence.join(" "), /revised commercial invoice/i);
    assert.match(plan.requiredEvidence.join(" "), /statement/i);
  });

  it("releasing the excess needs a separate declaration and no notification", () => {
    const plan = planOvershipment(30, "release_to_free_circulation", MONDAY);
    assert.equal(plan.requiresAdditionalFreeCirculationDeclaration, true);
    assert.equal(plan.requiresSupervisingOfficeNotification, false);
    assert.equal(plan.storeProvisionally, false);
    assert.equal(plan.notificationDeadline, undefined);
  });

  it("does not require a free-circulation declaration when the excess is warehoused", () => {
    const plan = planOvershipment(30, "warehouse_the_excess", MONDAY);
    assert.equal(plan.requiresAdditionalFreeCirculationDeclaration, false);
  });
});

describe("undershipment", () => {
  it("requires notification and an amendment, with the burden of proof on the depositor", () => {
    const plan = planUndershipment(10, MONDAY);
    assert.equal(plan.requiresSupervisingOfficeNotification, true);
    assert.equal(plan.amendOriginalEntry, true);
    assert.equal(plan.notificationDeadline, MONDAY + 14 * DAY);
    assert.match(plan.requiredEvidence[0], /not entered to the customs warehousing procedure/i);
  });
});

describe("validateReceipt", () => {
  const declared: DeclaredLine[] = [{ itemNumber: 1, declaredQuantity: 100 }];

  it("accepts a clean receipt against a released entry", () => {
    assert.deepEqual(
      validateReceipt({
        entryStatus: "AWAITING_RECEIPT",
        declared,
        received: [{ itemNumber: 1, receivedQuantity: 100 }],
        warehouseStatus: "active",
      }),
      [],
    );
  });

  it("refuses goods against an entry that has not been cleared", () => {
    const errors = validateReceipt({
      entryStatus: "H2_SUBMITTED",
      declared,
      received: [{ itemNumber: 1, receivedQuantity: 100 }],
    });
    assert.match(errors.join(" "), /cleared and released to warehousing/i);
  });

  it("refuses goods into a suspended warehouse", () => {
    const errors = validateReceipt({
      entryStatus: "AWAITING_RECEIPT",
      declared,
      received: [{ itemNumber: 1, receivedQuantity: 100 }],
      warehouseStatus: "suspended",
    });
    assert.match(errors.join(" "), /suspended/);
  });

  it("refuses a goods item that was not on the declaration", () => {
    const errors = validateReceipt({
      entryStatus: "AWAITING_RECEIPT",
      declared,
      received: [
        { itemNumber: 1, receivedQuantity: 100 },
        { itemNumber: 7, receivedQuantity: 5 },
      ],
    });
    assert.match(errors.join(" "), /item 7 was not on the entry declaration/i);
  });

  it("refuses a negative received quantity", () => {
    const errors = validateReceipt({
      entryStatus: "AWAITING_RECEIPT",
      declared,
      received: [{ itemNumber: 1, receivedQuantity: -5 }],
    });
    assert.match(errors.join(" "), /negative received quantity/i);
  });

  it("refuses an entry with nothing declared", () => {
    const errors = validateReceipt({ entryStatus: "AWAITING_RECEIPT", declared: [], received: [] });
    assert.match(errors.join(" "), /no declared goods items/i);
  });

  it("demands a decision when goods are over-shipped", () => {
    const errors = validateReceipt({
      entryStatus: "AWAITING_RECEIPT",
      declared,
      received: [{ itemNumber: 1, receivedQuantity: 130 }],
    });
    assert.match(errors.join(" "), /dutiable/i);
  });

  it("accepts an over-shipment once the intent is stated", () => {
    assert.deepEqual(
      validateReceipt({
        entryStatus: "AWAITING_RECEIPT",
        declared,
        received: [{ itemNumber: 1, receivedQuantity: 130 }],
        overshipmentIntent: "release_to_free_circulation",
      }),
      [],
    );
  });

  it("does not demand an intent for a shortage", () => {
    assert.deepEqual(
      validateReceipt({
        entryStatus: "AWAITING_RECEIPT",
        declared,
        received: [{ itemNumber: 1, receivedQuantity: 90 }],
      }),
      [],
    );
  });
});

describe("CW-DISCREPANCY-REPORT — a variance holds the entry open", () => {
  const declared: DeclaredLine[] = [{ itemNumber: 1, declaredQuantity: 100 }];

  it("closes the entry as RECEIVED when the goods match", () => {
    const lines = classifyReceipt(declared, [{ itemNumber: 1, receivedQuantity: 100 }]);
    assert.equal(statusAfterReceipt(lines), "RECEIVED");
  });

  it("holds the entry in DISCREPANCY when short", () => {
    const lines = classifyReceipt(declared, [{ itemNumber: 1, receivedQuantity: 90 }]);
    assert.equal(statusAfterReceipt(lines), "DISCREPANCY");
  });

  it("holds the entry in DISCREPANCY when over", () => {
    const lines = classifyReceipt(declared, [{ itemNumber: 1, receivedQuantity: 110 }]);
    assert.equal(statusAfterReceipt(lines), "DISCREPANCY");
  });
});

describe("CW-DBT-LICENCE-DEFERRED — obligations carried onto the lot", () => {
  it("notes the licence obligation without refusing the goods", () => {
    const warnings = obligationWarnings({ licenceRequired: true, preferenceClaimIntended: false });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /free circulation/i);
  });

  it("asks for the proof of origin at receipt when a preference is intended", () => {
    const warnings = obligationWarnings({ licenceRequired: false, preferenceClaimIntended: true });
    assert.match(warnings.join(" "), /stock reference number and the date of storage/i);
  });

  it("is quiet when the proof of origin is already recorded", () => {
    assert.deepEqual(
      obligationWarnings({
        licenceRequired: false,
        preferenceClaimIntended: true,
        proofOfOriginRef: "EUR1-99213",
      }),
      [],
    );
  });

  it("is quiet when nothing is outstanding", () => {
    assert.deepEqual(
      obligationWarnings({ licenceRequired: false, preferenceClaimIntended: false }),
      [],
    );
  });
});
