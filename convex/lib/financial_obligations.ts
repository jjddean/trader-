import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { FINANCIAL_LABELS as FL } from "./financial_labels";

export type ObligationType = "duty_a00" | "vat_b00";
export type ObligationAuthority = "derived" | "hmrc";
export type ObligationStatus = "estimated" | "confirmed";

export type FinancialRecordRowFromObligations = {
  id: string;
  mrn: string | undefined;
  type: string;
  amount: number;
  method: string;
  date: string;
  accountNumber: string;
  statementContext: string;
  paymentLimit: string;
  calculationMethod: string;
  natureOfTransaction: string;
  provenance: string;
  provenanceLabel: string;
  isAuthoritative: boolean;
};

const OBLIGATION_TYPE_LABEL: Record<ObligationType, string> = {
  duty_a00: "Duty (A00)",
  vat_b00: "Import VAT (B00)",
};

const OBLIGATION_SORT: Record<ObligationType, number> = {
  duty_a00: 0,
  vat_b00: 1,
};

export function financialRecordRowsFromObligations(
  decl: {
    _id: string;
    mrn?: unknown;
    created?: number;
    transactionNatureCode?: unknown;
  },
  obligations: Array<Pick<Doc<"financial_obligations">, "obligationType" | "amount" | "authority">>,
  payment: { label: string; accountNumber: string },
  customsValue: number,
): FinancialRecordRowFromObligations[] {
  const hasConfirmedFinancials = obligations.some((row) => row.authority === "hmrc");
  const dateStr = new Date(decl.created || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const transactionCode = decl.transactionNatureCode ? String(decl.transactionNatureCode) : "—";
  const statementContext =
    payment.accountNumber !== "—"
      ? "Deferment account on declaration (DE 2/6)"
      : hasConfirmedFinancials
        ? FL.statementFromHmrc
        : FL.statementEstimated;

  const sorted = [...obligations].sort(
    (a, b) =>
      OBLIGATION_SORT[a.obligationType as ObligationType] -
      OBLIGATION_SORT[b.obligationType as ObligationType],
  );

  return sorted.map((row) => {
    const obligationType = row.obligationType as ObligationType;
    const isDuty = obligationType === "duty_a00";
    const authoritative = row.authority === "hmrc";
    const idSuffix = isDuty ? "duty" : "vat";
    return {
      id: `${decl._id}-${idSuffix}`,
      mrn: decl.mrn ? String(decl.mrn) : undefined,
      type: OBLIGATION_TYPE_LABEL[obligationType],
      amount: row.amount,
      method: payment.label,
      date: dateStr,
      accountNumber: payment.accountNumber,
      statementContext,
      paymentLimit: "—",
      calculationMethod: authoritative
        ? isDuty
          ? FL.dutyConfirmedMethod
          : FL.vatConfirmedMethod
        : isDuty
          ? FL.dutyEstimatedMethod(customsValue)
          : FL.vatEstimatedMethod(customsValue),
      natureOfTransaction: transactionCode,
      provenance: authoritative ? "hmrc_confirmed" : "derived",
      provenanceLabel: authoritative ? FL.confirmedSettlement : FL.estimatedFromDeclaration,
      isAuthoritative: authoritative,
    };
  });
}

export interface FinancialObligationDraft {
  obligationType: ObligationType;
  amount: number;
  authority: ObligationAuthority;
  status: ObligationStatus;
  estimateAmount?: number;
  confirmedAt?: number;
}

export function buildFinancialObligationDrafts(input: {
  declarationStatus: string;
  mrn?: string | null;
  financialSource?: "hmrc_confirmed" | "derived";
  dutyAmount: number;
  vatAmount: number;
  derivedDutyAmount: number;
  derivedVatAmount: number;
  dmstaxUpdatedAt?: number;
}): FinancialObligationDraft[] | null {
  const mrn = String(input.mrn ?? "").trim();
  if (input.declarationStatus === "Draft" || !mrn) return null;
  if (input.financialSource === undefined) return null;

  const hmrc = input.financialSource === "hmrc_confirmed";
  const authority: ObligationAuthority = hmrc ? "hmrc" : "derived";
  const status: ObligationStatus = hmrc ? "confirmed" : "estimated";
  const confirmedAt = hmrc ? input.dmstaxUpdatedAt ?? Date.now() : undefined;

  const drafts: FinancialObligationDraft[] = [];

  const pushIfPositive = (
    obligationType: ObligationType,
    amount: number,
    derivedAmount: number,
  ) => {
    if (amount <= 0) return;
    const estimateAmount =
      hmrc && derivedAmount > 0 && Math.abs(derivedAmount - amount) > 0.009
        ? derivedAmount
        : undefined;
    drafts.push({
      obligationType,
      amount,
      authority,
      status,
      estimateAmount,
      confirmedAt,
    });
  };

  pushIfPositive("duty_a00", Number(input.dutyAmount || 0), Number(input.derivedDutyAmount || 0));
  pushIfPositive("vat_b00", Number(input.vatAmount || 0), Number(input.derivedVatAmount || 0));

  return drafts.length > 0 ? drafts : null;
}

export async function deleteFinancialObligationsForDeclaration(
  ctx: MutationCtx,
  declarationId: Id<"declarations">,
) {
  const rows = await ctx.db
    .query("financial_obligations")
    .withIndex("by_declaration", (q) => q.eq("declarationId", declarationId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete(row._id);
  }
}

export async function syncFinancialObligationsFromPreview(
  ctx: MutationCtx,
  args: {
    declaration: Doc<"declarations">;
    declarationId: Id<"declarations">;
    userId: string;
    declarationStatus: string;
    financialSource?: "hmrc_confirmed" | "derived";
    dutyAmount?: number;
    vatAmount?: number;
    derivedDutyAmount?: number;
    derivedVatAmount?: number;
    dmstaxUpdatedAt?: number;
  },
) {
  const drafts = buildFinancialObligationDrafts({
    declarationStatus: args.declarationStatus,
    mrn: args.declaration.mrn,
    financialSource: args.financialSource,
    dutyAmount: Number(args.dutyAmount || 0),
    vatAmount: Number(args.vatAmount || 0),
    derivedDutyAmount: Number(args.derivedDutyAmount || 0),
    derivedVatAmount: Number(args.derivedVatAmount || 0),
    dmstaxUpdatedAt: args.dmstaxUpdatedAt,
  });

  const existing = await ctx.db
    .query("financial_obligations")
    .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
    .collect();

  if (!drafts) {
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    return;
  }

  const now = Date.now();
  const mrn = args.declaration.mrn ? String(args.declaration.mrn) : undefined;
  const draftTypes = new Set(drafts.map((d) => d.obligationType));

  for (const row of existing) {
    if (!draftTypes.has(row.obligationType as ObligationType)) {
      await ctx.db.delete(row._id);
    }
  }

  for (const draft of drafts) {
    const existingRow = existing.find((row) => row.obligationType === draft.obligationType);
    const next = {
      declarationId: args.declarationId,
      userId: args.userId,
      orgId: args.declaration.orgId,
      clientId: args.declaration.clientId,
      mrn,
      obligationType: draft.obligationType,
      amount: draft.amount,
      currency: "GBP",
      authority: draft.authority,
      status: draft.status,
      estimateAmount: draft.estimateAmount,
      confirmedAt: draft.confirmedAt,
      updatedAt: now,
    };
    if (existingRow) {
      await ctx.db.patch(existingRow._id, next);
    } else {
      await ctx.db.insert("financial_obligations", next);
    }
  }
}
