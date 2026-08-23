/**
 * Receipt of goods into a customs warehouse.
 *
 * Spec: `docs/hmrc/customs-warehousing/IMPLEMENTATION_SPEC.md` §5, phase E
 * Handbook: `docs/hmrc/customs-warehousing/operations/receiving.md`
 * Rules: CW-ARRIVAL-5-DAYS, CW-DISCREPANCY-REPORT, CW-UNDERSHIPMENT-14-DAYS,
 *        CW-OVERSHIPMENT, CW-DBT-LICENCE-DEFERRED
 *
 * Pure functions. The Convex layer owns persistence; this owns what the
 * handbook says must happen between a cleared H2 and stock under procedure.
 *
 * Three things here are easy to get wrong and are therefore modelled
 * explicitly:
 *
 * 1. **The two clocks run from different dates.** Arrival is measured from the
 *    declaration being cleared; the discrepancy notification is measured from
 *    the date of entry to the procedure. They are not the same moment and a
 *    single `receivedAt - enteredAt` calculation would be wrong.
 * 2. **An overshipment does not amend the entry.** HMRC is explicit that excess
 *    goods the depositor does not want warehoused are covered by a *separate*
 *    free-circulation declaration, leaving the original untouched. Increasing
 *    the stock lot to match what turned up would put goods under the procedure
 *    that were never declared to it.
 * 3. **A missing licence is not a reason to refuse the goods.** DBT-licensable
 *    goods may be warehoused without the licence; the obligation moves to the
 *    stock record and lands at discharge.
 */

/** Entry lifecycle, from the handbook rather than invented. */
export type WarehouseEntryStatus =
  | "DRAFT"
  | "H2_SUBMITTED"
  | "CDS_ACCEPTED"
  | "RELEASED_TO_WAREHOUSING"
  | "AWAITING_RECEIPT"
  | "RECEIVED"
  | "DISCREPANCY"
  | "REJECTED";

/**
 * Permitted transitions.
 *
 * `DISCREPANCY` is reachable from `AWAITING_RECEIPT` and from `RECEIVED`,
 * because a shortage is often found during a later stock check rather than at
 * the door. It returns to `RECEIVED` once the supervising office has resolved
 * it and the entry has been amended.
 */
export const ENTRY_TRANSITIONS: Record<WarehouseEntryStatus, WarehouseEntryStatus[]> = {
  DRAFT: ["H2_SUBMITTED"],
  H2_SUBMITTED: ["CDS_ACCEPTED", "REJECTED"],
  CDS_ACCEPTED: ["RELEASED_TO_WAREHOUSING"],
  RELEASED_TO_WAREHOUSING: ["AWAITING_RECEIPT"],
  AWAITING_RECEIPT: ["RECEIVED", "DISCREPANCY"],
  RECEIVED: ["DISCREPANCY"],
  DISCREPANCY: ["RECEIVED"],
  REJECTED: [],
};

export function canTransition(from: WarehouseEntryStatus, to: WarehouseEntryStatus): boolean {
  return (ENTRY_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: WarehouseEntryStatus, to: WarehouseEntryStatus): string[] {
  if (canTransition(from, to)) return [];
  return [`A warehouse entry cannot move from ${from} to ${to}.`];
}

const DAY_MS = 86_400_000;

/**
 * Working days after a timestamp, counting Monday to Friday.
 *
 * Bank holidays are not modelled: HMRC publishes them per nation and the
 * handbook gives no list, so the result is the earliest a receipt could be
 * overdue. Treated as an advisory flag rather than a block for that reason.
 */
export function addWorkingDays(from: number, days: number): number {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.getTime();
}

/** CW-ARRIVAL-5-DAYS: goods are expected within 5 working days of clearance. */
export const ARRIVAL_WORKING_DAYS = 5;

export function arrivalDeadline(releasedAt: number): number {
  return addWorkingDays(releasedAt, ARRIVAL_WORKING_DAYS);
}

export interface ReceiptTimingInput {
  /** CDS clearance of the H2. The arrival clock starts here. */
  releasedAt?: number;
  receivedAt?: number;
}

/**
 * Whether a receipt is overdue.
 *
 * Advisory. The handbook asks for "a full explanation ... to the supervising
 * office by the depositor", so this surfaces the delay rather than preventing
 * the receipt.
 */
export function isReceiptOverdue(input: ReceiptTimingInput, now = Date.now()): boolean {
  if (!input.releasedAt) return false;
  const deadline = arrivalDeadline(input.releasedAt);
  return (input.receivedAt ?? now) > deadline;
}

/** CW-UNDERSHIPMENT-14-DAYS: notification runs from the date of entry. */
export const DISCREPANCY_NOTIFICATION_DAYS = 14;

export function discrepancyDeadline(enteredAt: number): number {
  return enteredAt + DISCREPANCY_NOTIFICATION_DAYS * DAY_MS;
}

export function isDiscrepancyNotificationLate(enteredAt: number, reportedAt: number): boolean {
  return reportedAt > discrepancyDeadline(enteredAt);
}

export type ReceiptOutcome = "MATCHED" | "UNDER_SHIPMENT" | "OVER_SHIPMENT";

export interface DeclaredLine {
  /** Goods item number on the H2, so a discrepancy names the line it affects. */
  itemNumber: number;
  declaredQuantity: number;
}

export interface ReceivedLine {
  itemNumber: number;
  receivedQuantity: number;
}

export interface LineComparison extends DeclaredLine {
  receivedQuantity: number;
  variance: number;
  outcome: ReceiptOutcome;
}

/**
 * Compare what was declared against what turned up, line by line.
 *
 * Per line rather than per entry: an entry can be short on one item and over on
 * another, and the two have different remedies.
 */
export function classifyReceipt(declared: DeclaredLine[], received: ReceivedLine[]): LineComparison[] {
  const byItem = new Map(received.map((r) => [r.itemNumber, r.receivedQuantity]));
  return declared.map((line) => {
    const receivedQuantity = byItem.get(line.itemNumber) ?? 0;
    const variance = receivedQuantity - line.declaredQuantity;
    return {
      ...line,
      receivedQuantity,
      variance,
      outcome: variance === 0 ? "MATCHED" : variance < 0 ? "UNDER_SHIPMENT" : "OVER_SHIPMENT",
    };
  });
}

export function receiptOutcome(lines: LineComparison[]): ReceiptOutcome {
  if (lines.some((l) => l.outcome === "OVER_SHIPMENT")) return "OVER_SHIPMENT";
  if (lines.some((l) => l.outcome === "UNDER_SHIPMENT")) return "UNDER_SHIPMENT";
  return "MATCHED";
}

/**
 * What the stock lot is credited with.
 *
 * Never the received quantity when it exceeds the declaration. Goods only enter
 * the procedure by being declared to it, so the excess is handled separately —
 * see `planOvershipment`.
 */
export function quantityToAdmit(line: LineComparison): number {
  return Math.min(line.declaredQuantity, line.receivedQuantity);
}

export type OvershipmentIntent = "warehouse_the_excess" | "release_to_free_circulation";

export interface OvershipmentPlan {
  excessQuantity: number;
  /** CW-OVERSHIPMENT is explicit that the original entry stays as declared. */
  amendOriginalEntry: false;
  requiresSupervisingOfficeNotification: boolean;
  /** Provisional storage pending the supervising office's decision. */
  storeProvisionally: boolean;
  requiresAdditionalFreeCirculationDeclaration: boolean;
  requiredEvidence: string[];
  notificationDeadline?: number;
}

/**
 * The two overshipment flows.
 *
 * HMRC treats excess goods as dutiable in both cases. The branch is what the
 * depositor wants to do with them, and the paperwork differs entirely.
 */
export function planOvershipment(
  excessQuantity: number,
  intent: OvershipmentIntent,
  enteredAt: number,
): OvershipmentPlan {
  if (intent === "warehouse_the_excess") {
    return {
      excessQuantity,
      amendOriginalEntry: false,
      requiresSupervisingOfficeNotification: true,
      storeProvisionally: true,
      requiresAdditionalFreeCirculationDeclaration: false,
      requiredEvidence: [
        "Revised commercial invoice covering the excess goods",
        "Statement confirming receipt of the excess goods",
      ],
      notificationDeadline: discrepancyDeadline(enteredAt),
    };
  }
  return {
    excessQuantity,
    amendOriginalEntry: false,
    requiresSupervisingOfficeNotification: false,
    storeProvisionally: false,
    requiresAdditionalFreeCirculationDeclaration: true,
    requiredEvidence: [],
  };
}

export interface UndershipmentPlan {
  shortQuantity: number;
  requiresSupervisingOfficeNotification: true;
  notificationDeadline: number;
  /** The entry is amended only once the supervising office has resolved it. */
  amendOriginalEntry: true;
  requiredEvidence: string[];
}

/**
 * A shortage.
 *
 * The burden of proof sits with the warehousekeeper or depositor: they must
 * show the missing goods were never entered to the procedure, otherwise the
 * shortfall looks like an unexplained removal.
 */
export function planUndershipment(shortQuantity: number, enteredAt: number): UndershipmentPlan {
  return {
    shortQuantity,
    requiresSupervisingOfficeNotification: true,
    notificationDeadline: discrepancyDeadline(enteredAt),
    amendOriginalEntry: true,
    requiredEvidence: [
      "Clear evidence that the shortage of goods was not entered to the customs warehousing procedure",
    ],
  };
}

export interface ReceiptValidationInput {
  entryStatus: WarehouseEntryStatus;
  declared: DeclaredLine[];
  received: ReceivedLine[];
  /** Required whenever any line is over-shipped. */
  overshipmentIntent?: OvershipmentIntent;
  warehouseStatus?: string;
}

/** Validate a proposed receipt before any stock lot is created. */
export function validateReceipt(input: ReceiptValidationInput): string[] {
  const errors: string[] = [];

  if (input.warehouseStatus && input.warehouseStatus !== "active") {
    errors.push(
      `The warehouse authorisation is ${input.warehouseStatus}; goods may not be received into the procedure.`,
    );
  }

  if (!canTransition(input.entryStatus, "RECEIVED") && input.entryStatus !== "RECEIVED") {
    errors.push(
      `Goods cannot be received against an entry in status ${input.entryStatus}. The H2 must be cleared and released to warehousing first.`,
    );
  }

  if (input.declared.length === 0) {
    errors.push("The entry has no declared goods items to receive against.");
  }

  const declaredItems = new Set(input.declared.map((d) => d.itemNumber));
  for (const line of input.received) {
    if (!declaredItems.has(line.itemNumber)) {
      errors.push(
        `Goods item ${line.itemNumber} was not on the entry declaration. Goods enter the procedure only by being declared to it.`,
      );
    }
    if (line.receivedQuantity < 0) {
      errors.push(`Goods item ${line.itemNumber} has a negative received quantity.`);
    }
  }

  const lines = classifyReceipt(input.declared, input.received);
  if (receiptOutcome(lines) === "OVER_SHIPMENT" && !input.overshipmentIntent) {
    errors.push(
      "More goods were received than were declared. Excess goods are dutiable — say whether they are to be warehoused or released to free circulation.",
    );
  }

  return errors;
}

/**
 * Whether the receipt leaves the entry in `RECEIVED` or `DISCREPANCY`.
 *
 * CW-DISCREPANCY-REPORT: any difference between the declaration and the goods
 * received must be reported, so a variance holds the entry open rather than
 * closing it.
 */
export function statusAfterReceipt(lines: LineComparison[]): WarehouseEntryStatus {
  return receiptOutcome(lines) === "MATCHED" ? "RECEIVED" : "DISCREPANCY";
}

/**
 * Obligations carried from the entry onto the stock lot.
 *
 * These are the flags the discharge gate reads later. Set at receipt because
 * that is when the warehousekeeper has the consignment in front of them —
 * HMRC expects the proof of origin to be endorsed with the stock reference and
 * the date of storage at this point, not at removal.
 */
export interface LotObligations {
  licenceRequired: boolean;
  preferenceClaimIntended: boolean;
  proofOfOriginRef?: string;
  quotaOrderNumber?: string;
}

export function obligationWarnings(o: LotObligations): string[] {
  const warnings: string[] = [];
  if (o.licenceRequired) {
    warnings.push(
      "Stock record noted: an import licence must be produced when these goods are declared to free circulation.",
    );
  }
  if (o.preferenceClaimIntended && !String(o.proofOfOriginRef ?? "").trim()) {
    warnings.push(
      "A preference is intended but no proof of origin is recorded. The proof should be received and endorsed with the stock reference number and the date of storage now — a preferential rate can only be claimed at removal to free circulation.",
    );
  }
  return warnings;
}
