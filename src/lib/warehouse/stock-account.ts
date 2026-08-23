/**
 * Customs warehouse stock account — balances, allocation and the document gate.
 *
 * Spec: `docs/hmrc/customs-warehousing/IMPLEMENTATION_SPEC.md` §4, §6
 * Rules: `docs/hmrc/customs-warehousing/validation/h2-rules.json` (operationalRules)
 * Handbook: `docs/hmrc/customs-warehousing/operations/`
 *
 * Pure functions over the ledger. No persistence here — Convex holds the rows;
 * this decides what they mean.
 *
 * Two principles from HMRC drive the design:
 *
 * 1. **Balances are derived, never stored as the truth.** The stock account is
 *    an audit trail, and an auditor reconciles the movements. A stored total
 *    that disagrees with its ledger is the failure mode this avoids.
 * 2. **Discharge to free circulation is blockable.** HMRC requires a duty
 *    management system to identify goods with a preference, quota or licensing
 *    restriction and ensure the certificate is available *before* release. That
 *    is a gate, not a report.
 */

export type MovementType =
  | "RECEIPT"
  | "INTERNAL_MOVE"
  | "TRANSFER"
  | "ADJUSTMENT"
  | "USUAL_FORM_OF_HANDLING"
  | "TEMPORARY_REMOVAL"
  | "RETURN"
  | "SAMPLING"
  | "LOSS"
  | "DESTRUCTION"
  | "DISCHARGE";

export interface WarehouseMovement {
  type: MovementType;
  /** Signed. Negative reduces stock under procedure. Zero for location moves. */
  quantity: number;
  occurredAt: number;
  recordedAt?: number;
  reason?: string;
  declarationRef?: string;
  documentRef?: string;
  approvalRef?: string;
}

/**
 * How each operation behaves, from the handbook.
 *
 * `requiresApproval` means the warehousekeeper needs the supervising office's
 * authorisation or prior notification — not that FreightCode grants it.
 * `reducesStock` is whether the operation can remove goods from the procedure.
 */
export const MOVEMENT_RULES: Record<
  MovementType,
  { reducesStock: boolean; requiresApproval: boolean; requiresReason: boolean; discharges: boolean; source: string }
> = {
  RECEIPT: { reducesStock: false, requiresApproval: false, requiresReason: false, discharges: false, source: "operations/receiving.md" },
  INTERNAL_MOVE: { reducesStock: false, requiresApproval: false, requiresReason: false, discharges: false, source: "operations/using-a-customs-warehouse.md" },
  TRANSFER: { reducesStock: true, requiresApproval: true, requiresReason: true, discharges: false, source: "operations/discharge.md" },
  ADJUSTMENT: { reducesStock: true, requiresApproval: false, requiresReason: true, discharges: false, source: "operations/receiving.md" },
  USUAL_FORM_OF_HANDLING: { reducesStock: false, requiresApproval: true, requiresReason: true, discharges: false, source: "operations/usual-forms-of-handling.md" },
  TEMPORARY_REMOVAL: { reducesStock: false, requiresApproval: true, requiresReason: true, discharges: false, source: "operations/temporary-removals.md" },
  RETURN: { reducesStock: false, requiresApproval: false, requiresReason: false, discharges: false, source: "operations/temporary-removals.md" },
  SAMPLING: { reducesStock: true, requiresApproval: true, requiresReason: true, discharges: false, source: "operations/sampling-and-testing.md" },
  LOSS: { reducesStock: true, requiresApproval: false, requiresReason: true, discharges: false, source: "operations/losses.md" },
  DESTRUCTION: { reducesStock: true, requiresApproval: true, requiresReason: true, discharges: true, source: "operations/destruction.md" },
  DISCHARGE: { reducesStock: true, requiresApproval: false, requiresReason: false, discharges: true, source: "operations/discharge.md" },
};

/**
 * A temporary removal does not discharge the procedure — the goods remain under
 * customs warehousing while off site. Modelled as zero-quantity so the balance
 * is unchanged; the lot's status carries the fact it is away.
 */
export const NON_DISCHARGING_ABSENCE: MovementType[] = ["TEMPORARY_REMOVAL", "RETURN"];

export interface StockLot {
  quantityEntered: number;
  licenceRequired?: boolean;
  licenceProducedAt?: number;
  preferenceClaimIntended?: boolean;
  proofOfOriginRef?: string;
  quotaOrderNumber?: string;
  status?: string;
}

/** Balance under procedure, derived from the ledger rather than stored. */
export function deriveBalance(lot: StockLot, movements: WarehouseMovement[]): number {
  return movements.reduce((balance, m) => balance + m.quantity, 0);
}

/**
 * Recompute the ledger, returning each movement's running balance.
 *
 * Used to detect a ledger that has drifted from its stored `balanceAfter`
 * values — the reconciliation an HMRC officer can ask to witness.
 */
export function replayLedger(movements: WarehouseMovement[]): { balances: number[]; final: number } {
  const ordered = [...movements].sort((a, b) => a.occurredAt - b.occurredAt);
  const balances: number[] = [];
  let running = 0;
  for (const m of ordered) {
    running += m.quantity;
    balances.push(running);
  }
  return { balances, final: running };
}

export interface MovementValidationInput {
  lot: StockLot;
  movements: WarehouseMovement[];
  proposed: WarehouseMovement;
  /** From the warehouse record — some operations need the authorisation. */
  warehouse?: { ufhApproved?: boolean; fifoApproved?: boolean; status?: string };
}

/** Validate a proposed movement against the ledger and HMRC's rules. */
export function validateMovement(input: MovementValidationInput): string[] {
  const errors: string[] = [];
  const { lot, movements, proposed, warehouse } = input;
  const rules = MOVEMENT_RULES[proposed.type];

  if (!rules) {
    errors.push(`Unknown movement type ${proposed.type}`);
    return errors;
  }

  if (warehouse?.status && warehouse.status !== "active") {
    errors.push(`The warehouse authorisation is ${warehouse.status}; no movement may be recorded.`);
  }

  if (rules.requiresReason && !String(proposed.reason ?? "").trim()) {
    errors.push(`${proposed.type} requires a reason for the audit trail.`);
  }

  if (rules.requiresApproval && !String(proposed.approvalRef ?? "").trim()) {
    errors.push(
      `${proposed.type} requires the supervising office's approval or prior notification reference (see ${rules.source}).`,
    );
  }

  if (proposed.type === "USUAL_FORM_OF_HANDLING" && warehouse && !warehouse.ufhApproved) {
    errors.push("Usual forms of handling are not authorised for this warehouse.");
  }

  const balance = deriveBalance(lot, movements);

  if (rules.reducesStock) {
    if (proposed.quantity >= 0) {
      errors.push(`${proposed.type} must carry a negative quantity — it removes goods from the procedure.`);
    } else if (Math.abs(proposed.quantity) > balance) {
      errors.push(
        `Cannot remove ${Math.abs(proposed.quantity)} — only ${balance} remains under procedure on this lot.`,
      );
    }
  }

  if (NON_DISCHARGING_ABSENCE.includes(proposed.type) && proposed.quantity !== 0) {
    errors.push(
      `${proposed.type} does not change the balance — the goods remain under the customs warehousing procedure while off site.`,
    );
  }

  if (lot.status === "DISCHARGED" && proposed.type !== "ADJUSTMENT") {
    errors.push("This lot is fully discharged; no further movement may be recorded.");
  }

  return errors;
}

export interface DischargeRequest {
  quantity: number;
  dischargeType: "free_circulation" | "re_export" | "other_procedure" | "destruction";
  declarationRef?: string;
  acceptedAt?: number;
}

/**
 * The document gate.
 *
 * HMRC's approval condition for a duty management system:
 *
 * > "identify goods with a tariff preference or quota or licensing restriction
 * > and make sure the appropriate certificate or licence is available prior to
 * > the removal of the goods to free circulation"
 *
 * Applies to **free circulation only**. Re-export does not create a customs
 * debt and does not consume a preference, so blocking it would be wrong.
 */
export function checkDischargeDocuments(lot: StockLot, request: DischargeRequest): string[] {
  if (request.dischargeType !== "free_circulation") return [];
  const errors: string[] = [];

  if (lot.licenceRequired && !lot.licenceProducedAt) {
    errors.push(
      "This lot is flagged as requiring an import licence. The licence must be produced before the goods are released to free circulation.",
    );
  }
  if (lot.preferenceClaimIntended && !String(lot.proofOfOriginRef ?? "").trim()) {
    errors.push(
      "A preference was claimed at entry, so valid proof of origin must be recorded before release to free circulation.",
    );
  }
  if (String(lot.quotaOrderNumber ?? "").trim() && !String(lot.proofOfOriginRef ?? "").trim()) {
    errors.push(
      "A quota order number is recorded against this lot; the supporting certificate must be available before release.",
    );
  }
  return errors;
}

/** Validate a discharge: the document gate, then quantity, then the duty point. */
export function validateDischarge(
  lot: StockLot,
  movements: WarehouseMovement[],
  request: DischargeRequest,
): string[] {
  const errors = checkDischargeDocuments(lot, request);

  const balance = deriveBalance(lot, movements);
  if (request.quantity <= 0) {
    errors.push("Discharge quantity must be greater than zero.");
  } else if (request.quantity > balance) {
    errors.push(`Cannot discharge ${request.quantity} — only ${balance} remains under procedure.`);
  }

  // The duty point is the acceptance date of the removal declaration; it fixes
  // the rate regardless of when the goods physically move.
  if (request.dischargeType === "free_circulation" && !request.acceptedAt) {
    errors.push(
      "A release to free circulation needs the acceptance date of the removal declaration — it is the duty point and sets the rate.",
    );
  }

  return errors;
}

/** Lot status implied by the ledger. Derived, so it cannot drift. */
export function deriveLotStatus(
  lot: StockLot,
  movements: WarehouseMovement[],
): "UNDER_PROCEDURE" | "PARTIALLY_DISCHARGED" | "DISCHARGED" | "TEMPORARILY_REMOVED" {
  const balance = deriveBalance(lot, movements);
  if (balance <= 0) return "DISCHARGED";

  const ordered = [...movements].sort((a, b) => a.occurredAt - b.occurredAt);
  const lastAbsence = [...ordered].reverse().find((m) => NON_DISCHARGING_ABSENCE.includes(m.type));
  if (lastAbsence?.type === "TEMPORARY_REMOVAL") return "TEMPORARILY_REMOVED";

  return balance < lot.quantityEntered ? "PARTIALLY_DISCHARGED" : "UNDER_PROCEDURE";
}

/**
 * Whether stock records are within HMRC's update deadline.
 *
 * Real time: records must always reflect current stock, so any lag is a breach.
 * Closing balance: updates must land before midnight of the following warehouse
 * operation day.
 */
export function isWithinUpdateDeadline(
  movement: WarehouseMovement,
  mode: "real_time" | "closing_balance",
  now = Date.now(),
): boolean {
  const recorded = movement.recordedAt ?? now;
  if (mode === "real_time") {
    // A minute of slack for processing; anything beyond is a lag.
    return recorded - movement.occurredAt <= 60_000;
  }
  const deadline = new Date(movement.occurredAt);
  deadline.setUTCDate(deadline.getUTCDate() + 2);
  deadline.setUTCHours(0, 0, 0, 0);
  return recorded < deadline.getTime();
}

/**
 * FIFO allocation across lots sharing an 8-digit commodity code.
 *
 * HMRC permits, and does not require, FIFO where goods share an 8-digit
 * commodity code, commercial quality and technical characteristics and cannot
 * be told apart. It does not relieve the preference or proof-of-origin
 * obligations, so allocation returns the lots and the caller still runs the
 * document gate on each.
 */
export function allocateFifo<T extends { enteredAt: number; quantityRemaining: number }>(
  lots: T[],
  quantity: number,
): { lot: T; take: number }[] {
  const ordered = [...lots]
    .filter((l) => l.quantityRemaining > 0)
    .sort((a, b) => a.enteredAt - b.enteredAt);

  const allocation: { lot: T; take: number }[] = [];
  let outstanding = quantity;
  for (const lot of ordered) {
    if (outstanding <= 0) break;
    const take = Math.min(lot.quantityRemaining, outstanding);
    allocation.push({ lot, take });
    outstanding -= take;
  }
  return outstanding > 0 ? [] : allocation;
}
