import { v } from "convex/values";
import { FINANCIAL_LABELS as FL } from "./lib/financial_labels";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { evaluateCompleteness } from "./lib/declaration_completeness";
import { replayDeclarationStatus } from "./lib/replay_declaration_status";
import { collectDeclarationNotifications } from "./lib/collect_declaration_notifications";
import { resolveDeclarationCdsBadge } from "./lib/cds_badge";
import { requireAdmin } from "./lib/user_role";
import type { RuleDefinition } from "./lib/rule_engine";
import {
  estimateItemDutyFromTariff,
  evaluatePreferenceOptions,
} from "./lib/duty_rate_parser";
import type { TariffJsonApi } from "./lib/tariff_parser";
import {
  canAccessDeclaration,
  getActiveOrgId,
  listDeclarationPreviewsForTenant,
  listDeclarationsForTenant,
  orgIdFromDeclaration,
  resolveOrgIdForNewRecord,
} from "./lib/org_access";

type EstimateMethod = "tariff_measures" | "historical_fallback" | "hmrc_confirmed";

const preferenceCountries = new Set(["BD", "PK", "LK", "KE", "GH", "NG", "TZ", "UG", "ZM", "ZW"]);
const hsDutyRateByPrefix: Record<string, number> = {
  "61": 0.12,
  "62": 0.12,
  "64": 0.08,
  "84": 0.035,
  "85": 0.03,
  "87": 0.1,
  "90": 0.025,
};

function parseNumberish(value: any) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getHistoricalRateMap(ctx: any, userId: string) {
  const orgId = await getActiveOrgId(ctx, userId);

  if (orgId) {
    const cached = await ctx.db
      .query("rate_cache")
      .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
      .first();
    if (cached) return cached.rateMap as Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>;

    const rows = await ctx.db
      .query("historical_declarations")
      .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
      .take(2000);

    return buildRateMap(rows);
  }

  const cached = await ctx.db
    .query("rate_cache")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (cached) return cached.rateMap as Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>;

  // Cold path — no cache yet (before first ingest). Build from raw rows.
  const rows = await ctx.db
    .query("historical_declarations")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(2000);

  return buildRateMap(rows);
}

function buildRateMap(rows: any[]) {
  const rateMap: Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }> = {};
  for (const row of rows) {
    const commodityCode = String(row.commodityCode || "");
    const prefix = commodityCode.substring(0, 2);
    if (!prefix) continue;

    const customsValue = parseNumberish(row.itemCustomsValue);
    const taxAmount = parseNumberish(row.taxLineTotalAmount);
    if (!customsValue || !taxAmount) continue;

    if (!rateMap[prefix]) {
      rateMap[prefix] = { dutyTotal: 0, vatTotal: 0, customsTotal: 0 };
    }
    if (String(row.taxType || "").toUpperCase().includes("A00")) {
      rateMap[prefix].dutyTotal += taxAmount;
      rateMap[prefix].customsTotal += customsValue;
    }
    if (String(row.taxType || "").toUpperCase().includes("B00")) {
      rateMap[prefix].vatTotal += taxAmount;
      rateMap[prefix].customsTotal += customsValue;
    }
  }
  return rateMap;
}

function resolveRates(item: any, historicalRates: Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>) {
  const code = String(item?.commodityCode || "");
  const prefix = code.substring(0, 2);
  const historical = historicalRates[prefix];

  const historicalDutyRate =
    historical && historical.customsTotal > 0
      ? historical.dutyTotal / historical.customsTotal
      : null;
  const historicalVatRate =
    historical && historical.customsTotal > 0
      ? historical.vatTotal / historical.customsTotal
      : null;

  const baseDutyRate = historicalDutyRate ?? hsDutyRateByPrefix[prefix] ?? 0.06;
  const originCountry = String(item?.originCountry || "").toUpperCase();
  const effectiveDutyRate = preferenceCountries.has(originCountry) ? 0 : baseDutyRate;
  const vatRate = historicalVatRate ?? 0.2;

  return { dutyRate: effectiveDutyRate, vatRate };
}

function hmrcStatusForDeclaration(decl: any, notifications: any[]) {
  if (decl?.status === "Draft") return { score: 0, status: "Draft" };
  const latestType = notifications[0]?.notificationType;
  if (latestType === "DMSCLE") return { score: 100, status: "Clean" };
  if (latestType === "DMSACC") return { score: 85, status: "Accepted" };
  if (latestType === "DMSROG") return { score: 60, status: "Action Required" };
  if (latestType === "DMSREJ") return { score: 0, status: "Action Required" };
  if (latestType === "DMSINV") return { score: 0, status: "Action Required" };
  if (latestType === "DMSUB") return { score: 50, status: "Submitted" };

  if (decl.status === "Cleared") return { score: 100, status: "Clean" };
  if (decl.status === "Accepted") return { score: 85, status: "Accepted" };
  if (decl.status === "Rejected" || decl.status === "Invalid" || decl.status === "Action Required") return { score: 0, status: "Action Required" };
  if (decl.status === "Submitted") return { score: 50, status: "Submitted" };
  return { score: 0, status: "Pending" };
}

const HMRC_CONFIRMED_NOTIFICATION_TYPES = new Set(["DMSCLE", "DMSACC", "DMSROG", "DMSREJ", "DMSINV"]);
const HMRC_CONFIRMED_DECLARATION_STATUSES = new Set(["Cleared", "Accepted", "Rejected", "Invalid", "Action Required"]);

function isHmrcConfirmedDeclaration(decl: any, notifications: any[]) {
  const latestType = String(notifications[0]?.notificationType || "").toUpperCase();
  if (HMRC_CONFIRMED_NOTIFICATION_TYPES.has(latestType)) return true;
  return HMRC_CONFIRMED_DECLARATION_STATUSES.has(String(decl?.status || ""));
}

function parseRawPayload(rawPayload: any): any | null {
  if (!rawPayload) return null;
  if (typeof rawPayload === "object") return rawPayload;
  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return null;
    }
  }
  return null;
}

function extractTaxFromXml(raw: string, typeCode: "A00" | "B00"): number {
  let total = 0;
  const feeRegex = /<(?:[^>]*:)?DutyTaxFee[\s\S]*?<\/(?:[^>]*:)?DutyTaxFee>/gi;
  let match: RegExpExecArray | null;
  while ((match = feeRegex.exec(raw)) !== null) {
    const block = match[0];
    if (!new RegExp(`<(?:[^>]*:)?TypeCode[^>]*>${typeCode}<\\/(?:[^>]*:)?TypeCode>`, "i").test(block)) {
      continue;
    }
    const amountMatch = block.match(
      /<(?:[^>]*:)?(?:AdhocAmount|PaymentAmount|TaxAssessedAmount)[^>]*>([\d.]+)<\//i,
    );
    if (amountMatch?.[1]) {
      const amount = Number(amountMatch[1]);
      if (Number.isFinite(amount)) total += amount;
    }
  }
  return total;
}

function extractConfirmedFinancials(notifications: any[]) {
  for (const notification of notifications) {
    const notifType = String(notification?.notificationType || "").toUpperCase();
    if (notifType !== "DMSTAX" && notifType !== "UNKNOWN") continue;

    const raw = notification?.rawPayload;
    const rawStr = typeof raw === "string" ? raw : "";
    if (rawStr.includes("<")) {
      const duty = extractTaxFromXml(rawStr, "A00");
      const vat = extractTaxFromXml(rawStr, "B00");
      if (duty > 0 || vat > 0) {
        return { duty, vat };
      }
    }

    const payload = parseRawPayload(raw);
    if (!payload) continue;
    const duty = findNumericByKeyPattern(payload, /(duty|a00).*(amount|paid|total)|^(duty|a00)$/i);
    const vat = findNumericByKeyPattern(payload, /(vat|b00).*(amount|paid|total)|^(vat|b00)$/i);
    if ((duty && duty > 0) || (vat && vat > 0)) {
      return {
        duty: duty || 0,
        vat: vat || 0,
      };
    }
  }
  return null;
}

type HistoricalRateMap = Record<string, { dutyTotal: number; vatTotal: number; customsTotal: number }>;
type TariffCacheMap = Record<string, TariffJsonApi>;

async function loadTariffCachesForCommodityCodes(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  commodityCodes: string[],
): Promise<TariffCacheMap> {
  const unique = [...new Set(commodityCodes.map((c) => String(c || "").trim()).filter((c) => c.length === 10))];
  const map: TariffCacheMap = {};
  await Promise.all(
    unique.map(async (code) => {
      const row = await ctx.db
        .query("tariff_cache")
        .withIndex("by_commodity", (q) => q.eq("commodityCode", code))
        .first();
      if (row?.rawResponse) map[code] = row.rawResponse as TariffJsonApi;
    }),
  );
  return map;
}

function estimateItemFinancials(
  item: any,
  historicalRates: HistoricalRateMap,
  tariffByCommodityCode?: TariffCacheMap,
) {
  const val = Number(item.valueAmount || 0);
  const code = String(item?.commodityCode || "").trim();
  const tariffDoc = code.length === 10 ? tariffByCommodityCode?.[code] : undefined;
  const input = {
    customsValueGbp: val,
    netWeightKg: item?.netWeightKg != null ? Number(item.netWeightKg) : undefined,
    supplementaryUnitQty:
      item?.supplementaryUnitQty != null ? Number(item.supplementaryUnitQty) : undefined,
  };

  if (tariffDoc) {
    const tariffEstimate = estimateItemDutyFromTariff(tariffDoc, {
      originCountry: String(item?.originCountry || ""),
      preferenceCode: item?.preferenceCode != null ? String(item.preferenceCode) : undefined,
      input,
    });

    if (tariffEstimate && !tariffEstimate.incompleteInput) {
      const itemDuty = tariffEstimate.dutyAmount;
      const itemVat = (val + itemDuty) * tariffEstimate.vatRate;
      return {
        val,
        itemDuty,
        itemVat,
        tariffSource: tariffEstimate.source as string | undefined,
        estimateMethod: "tariff_measures" as const,
        incompleteInput: false,
      };
    }

    if (tariffEstimate?.incompleteInput) {
      return {
        val,
        itemDuty: 0,
        itemVat: val * 0.2,
        tariffSource: tariffEstimate.source as string | undefined,
        estimateMethod: "tariff_measures" as const,
        incompleteInput: true,
      };
    }
  }

  const { dutyRate, vatRate } = resolveRates(item, historicalRates);
  return {
    val,
    itemDuty: val * dutyRate,
    itemVat: (val + val * dutyRate) * vatRate,
    tariffSource: undefined as string | undefined,
    estimateMethod: "historical_fallback" as const,
    incompleteInput: false,
  };
}

function computePotentialPreferenceSaving(
  items: any[],
  tariffByCommodityCode?: TariffCacheMap,
): number | null {
  if (!tariffByCommodityCode) return null;

  let saving = 0;
  let computed = false;

  for (const item of items) {
    const code = String(item?.commodityCode || "").trim();
    const tariffDoc = code.length === 10 ? tariffByCommodityCode[code] : undefined;
    if (!tariffDoc) continue;

    const val = Number(item.valueAmount || 0);
    const input = {
      customsValueGbp: val,
      netWeightKg: item?.netWeightKg != null ? Number(item.netWeightKg) : undefined,
      supplementaryUnitQty:
        item?.supplementaryUnitQty != null ? Number(item.supplementaryUnitQty) : undefined,
    };
    const originCountry = String(item?.originCountry || "");
    const preferenceCode = item?.preferenceCode != null ? String(item.preferenceCode) : undefined;

    const declared = estimateItemDutyFromTariff(tariffDoc, {
      originCountry,
      preferenceCode,
      input,
    });
    const options = evaluatePreferenceOptions(tariffDoc, { originCountry, input });
    if (!declared || declared.incompleteInput || !options?.best || options.best.incompleteInput) continue;

    const delta = declared.dutyAmount - options.best.dutyAmount;
    if (delta > 0.009) {
      saving += delta;
      computed = true;
    }
  }

  return computed ? saving : null;
}

function computeDeclarationFinancials(
  items: any[],
  notifications: any[],
  historicalRates: HistoricalRateMap,
  tariffByCommodityCode?: TariffCacheMap,
) {
  let derivedDuty = 0;
  let derivedVat = 0;
  let declValue = 0;
  let usedFallback = false;
  let estimateIncomplete = false;

  for (const item of items) {
    const { val, itemDuty, itemVat, estimateMethod, incompleteInput } = estimateItemFinancials(
      item,
      historicalRates,
      tariffByCommodityCode,
    );
    declValue += val;
    derivedDuty += itemDuty;
    derivedVat += itemVat;
    if (estimateMethod === "historical_fallback") usedFallback = true;
    if (incompleteInput) estimateIncomplete = true;
  }

  const confirmed = extractConfirmedFinancials(notifications);
  const hasConfirmedFinancials = !!(confirmed && (confirmed.duty > 0 || confirmed.vat > 0));
  const duty = hasConfirmedFinancials ? confirmed!.duty : derivedDuty;
  const vat = hasConfirmedFinancials ? confirmed!.vat : derivedVat;

  let estimateMethod: EstimateMethod = "tariff_measures";
  if (hasConfirmedFinancials) {
    estimateMethod = "hmrc_confirmed";
  } else if (usedFallback) {
    estimateMethod = "historical_fallback";
  }

  const potentialPreferenceSaving = hasConfirmedFinancials
    ? null
    : computePotentialPreferenceSaving(items, tariffByCommodityCode);

  return {
    declValue,
    duty,
    vat,
    derivedDuty,
    derivedVat,
    hasConfirmedFinancials,
    confirmedDuty: confirmed?.duty ?? null,
    confirmedVat: confirmed?.vat ?? null,
    estimateMethod,
    estimateIncomplete,
    potentialPreferenceSaving,
  };
}

function latestDmstaxTimestamp(notifications: any[]): number | undefined {
  let latest: number | undefined;
  for (const notification of notifications) {
    const notifType = String(notification?.notificationType || "").toUpperCase();
    if (notifType !== "DMSTAX") continue;
    const raw =
      typeof notification?.issueDateTime === "string"
        ? notification.issueDateTime
        : notification?.timestamp;
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) continue;
    if (latest === undefined || ms > latest) latest = ms;
  }
  return latest;
}

function resolvePaymentMethodLabel(
  declaration: Doc<"declarations">,
  hasConfirmedFinancials: boolean,
): { label: string; accountNumber: string } {
  const dan = String(declaration.defermentAccountNumber ?? "").trim();
  const mop = String(declaration.paymentMethodCode ?? "").trim();

  if (dan) {
    const mopLabel =
      mop === "E" ? "Deferment (DE 4/8 E)" : mop ? `Method ${mop}` : "Deferment account";
    return { label: mopLabel, accountNumber: dan };
  }

  if (hasConfirmedFinancials) {
    return { label: FL.paymentHmrcAssessed, accountNumber: "—" };
  }

  return { label: "Estimated — not on declaration", accountNumber: "—" };
}

async function buildFinancialPreviewFields(
  ctx: Pick<QueryCtx, "db">,
  declaration: Doc<"declarations">,
  declarationId: Id<"declarations">,
  items: any[],
  userId: string,
) {
  const historicalRates = await getHistoricalRateMap(ctx, userId);
  const notificationRows = await collectDeclarationNotifications(ctx.db, {
    declarationId,
    conversationId: declaration.conversationId,
    mrn: declaration.mrn,
  });
  const tariffByCommodityCode = await loadTariffCachesForCommodityCodes(
    ctx,
    items.map((item) => String(item?.commodityCode || "")),
  );
  const financials = computeDeclarationFinancials(
    items,
    notificationRows,
    historicalRates,
    tariffByCommodityCode,
  );
  const payment = resolvePaymentMethodLabel(declaration, financials.hasConfirmedFinancials);
  const dmstaxUpdatedAt = financials.hasConfirmedFinancials
    ? latestDmstaxTimestamp(notificationRows)
    : undefined;

  return {
    dutyAmount: financials.duty,
    vatAmount: financials.vat,
    customsValue: financials.declValue,
    derivedDutyAmount: financials.derivedDuty,
    derivedVatAmount: financials.derivedVat,
    financialSource: financials.hasConfirmedFinancials
      ? ("hmrc_confirmed" as const)
      : ("derived" as const),
    estimateMethod: financials.estimateMethod,
    estimateIncomplete: financials.estimateIncomplete,
    potentialPreferenceSaving: financials.potentialPreferenceSaving ?? undefined,
    dmstaxUpdatedAt,
    defermentAccountNumber: payment.accountNumber !== "—" ? payment.accountNumber : undefined,
    paymentMethodLabel: payment.label,
  };
}

function financialsFromPreview(preview: Doc<"declaration_preview">): ReturnType<typeof computeDeclarationFinancials> {
  const hasConfirmedFinancials = preview.financialSource === "hmrc_confirmed";
  return {
    declValue: Number(preview.customsValue || 0),
    duty: Number(preview.dutyAmount || 0),
    vat: Number(preview.vatAmount || 0),
    derivedDuty: Number(preview.derivedDutyAmount || 0),
    derivedVat: Number(preview.derivedVatAmount || 0),
    hasConfirmedFinancials,
    confirmedDuty: hasConfirmedFinancials ? Number(preview.dutyAmount || 0) : null,
    confirmedVat: hasConfirmedFinancials ? Number(preview.vatAmount || 0) : null,
    estimateMethod:
      preview.estimateMethod ??
      (hasConfirmedFinancials ? "hmrc_confirmed" : "historical_fallback"),
    estimateIncomplete: preview.estimateIncomplete ?? false,
    potentialPreferenceSaving: preview.potentialPreferenceSaving ?? null,
  };
}

interface FinancialRecord {
  id: string;
  mrn: string;
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
}

function buildFinancialRecordsForDeclaration(
  decl: Doc<"declarations">,
  financials: ReturnType<typeof computeDeclarationFinancials>,
  payment: { label: string; accountNumber: string },
) {
  const records: FinancialRecord[] = [];
  const { declValue, duty, vat, hasConfirmedFinancials } = financials;

  const dateStr = new Date(decl.created || Date.now()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const provenance = hasConfirmedFinancials ? "hmrc_confirmed" : "derived";
  const provenanceLabel = hasConfirmedFinancials
    ? FL.confirmedSettlement
    : FL.estimatedFromDeclaration;
  const transactionCode = decl.transactionNatureCode ? String(decl.transactionNatureCode) : "—";
  const statementContext = payment.accountNumber !== "—"
    ? "Deferment account on declaration (DE 2/6)"
    : hasConfirmedFinancials
      ? FL.statementFromHmrc
      : FL.statementEstimated;

  if (duty > 0) {
    records.push({
      id: `${decl._id}-duty`,
      mrn: String(decl.mrn || "—"),
      type: "Duty (A00)",
      amount: duty,
      method: payment.label,
      date: dateStr,
      accountNumber: payment.accountNumber,
      statementContext,
      paymentLimit: "—",
      calculationMethod: hasConfirmedFinancials
        ? FL.dutyConfirmedMethod
        : FL.dutyEstimatedMethod(declValue),
      natureOfTransaction: transactionCode,
      provenance,
      provenanceLabel,
      isAuthoritative: hasConfirmedFinancials,
    });
  }

  if (vat > 0) {
    records.push({
      id: `${decl._id}-vat`,
      mrn: String(decl.mrn || "—"),
      type: "Import VAT (B00)",
      amount: vat,
      method: payment.label,
      date: dateStr,
      accountNumber: payment.accountNumber,
      statementContext,
      paymentLimit: "—",
      calculationMethod: hasConfirmedFinancials
        ? FL.vatConfirmedMethod
        : FL.vatEstimatedMethod(declValue),
      natureOfTransaction: transactionCode,
      provenance,
      provenanceLabel,
      isAuthoritative: hasConfirmedFinancials,
    });
  }

  return records;
}

function formatConsignor(decl: Doc<"declarations">): string {
  if (decl.exporterName) return String(decl.exporterName);
  const parts = [decl.exporterLine, decl.exporterCity, decl.exporterPostcode].filter(Boolean);
  if (parts.length > 0) return parts.map(String).join(", ");
  if (decl.exporterEori) return String(decl.exporterEori);
  return "—";
}

function displayOrDash(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : "—";
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function buildNotificationsByDeclaration(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
): Promise<Map<string, any[]>> {
  const allNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(400);

  const notificationsByDeclaration = new Map<string, any[]>();
  for (const notification of allNotifications) {
    const declarationId = String(notification.declarationId || "");
    if (!declarationId) continue;
    if (!notificationsByDeclaration.has(declarationId)) {
      notificationsByDeclaration.set(declarationId, []);
    }
    notificationsByDeclaration.get(declarationId)!.push(notification);
  }

  for (const bucket of notificationsByDeclaration.values()) {
    bucket.sort(
      (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
    );
  }

  return notificationsByDeclaration;
}

async function buildSubmitLrnByDeclaration(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
): Promise<Map<string, string>> {
  const submissions = await ctx.db
    .query("submissions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(500);

  const lrnByDeclaration = new Map<string, string>();
  for (const submission of submissions) {
    const declarationId = String(submission.declarationId);
    if (submission.operation !== "submit" || !submission.lrn) continue;
    if (!lrnByDeclaration.has(declarationId)) {
      lrnByDeclaration.set(declarationId, String(submission.lrn));
    }
  }
  return lrnByDeclaration;
}

function findNumericByKeyPattern(input: any, regex: RegExp): number | null {
  const stack = [input];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    if (typeof node !== "object") continue;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") {
        stack.push(value);
      } else if (regex.test(String(key))) {
        const num = Number(value);
        if (Number.isFinite(num)) return num;
      }
    }
  }
  return null;
}

function isReviewStatus(status: string | undefined) {
  return status === "Action Required" || status === "Rejected" || status === "Invalid";
}

type DeclarationStatusSource = Pick<Doc<"declarations">, "status" | "mrn">;

async function resolveStatusAndBadge(
  ctx: Pick<QueryCtx, "db">,
  declarationId: Id<"declarations">,
  declaration: DeclarationStatusSource & { conversationId?: string | null },
) {
  const notificationRows = await collectDeclarationNotifications(ctx.db, {
    declarationId,
    conversationId: declaration.conversationId,
    mrn: declaration.mrn,
  });

  const status = replayDeclarationStatus(
    String(declaration.status ?? "Draft"),
    declaration.mrn,
    notificationRows,
  );

  const cdsBadge = resolveDeclarationCdsBadge(status, notificationRows);

  return {
    status,
    cdsBadgeLabel: cdsBadge.label,
    cdsBadgeTone: cdsBadge.tone,
  };
}

async function effectiveDeclarationStatus(
  ctx: Pick<QueryCtx, "db">,
  declarationId: Id<"declarations">,
  declaration: DeclarationStatusSource & { conversationId?: string | null },
): Promise<string> {
  const { status } = await resolveStatusAndBadge(ctx, declarationId, declaration);
  return status;
}

async function recomputeDashboardSummaryByUser(ctx: any, userId: string) {
  const previews = await ctx.db
    .query("declaration_preview")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .take(5000);

  let reviewCount = 0;
  let totalValue = 0;
  for (const preview of previews) {
    if (isReviewStatus(preview.status)) reviewCount += 1;
    totalValue += Number(preview.totalValue || 0);
  }

  const existing = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  const next = {
    userId,
    totalDeclarations: previews.length,
    reviewCount,
    totalValue,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
  } else {
    await ctx.db.insert("dashboard_summary", next);
  }
}

async function upsertDeclarationPreviewByDeclaration(
  ctx: MutationCtx,
  declarationId: Id<"declarations">,
) {
  const declaration = await ctx.db.get(declarationId);
  const existingPreview = await ctx.db
    .query("declaration_preview")
    .withIndex("by_declarationId", (q: any) => q.eq("declarationId", declarationId))
    .first();

  if (!declaration) {
    if (existingPreview) await ctx.db.delete(existingPreview._id);
    return;
  }

  const declarationUserId = typeof declaration.userId === "string" ? declaration.userId : "";
  const items = await ctx.db
    .query("goods_items")
    .withIndex("by_declaration", (q: any) => q.eq("declarationId", declarationId))
    .take(2000);

  let totalValue = 0;
  for (const item of items) totalValue += parseNumberish(item.valueAmount);

  // Single source of truth: rule engine. evaluateCompleteness is just the
  // translator from ValidationResult[] to {field, reason}. Persist only the
  // summary (ready + count) on the preview row; the dashboard subscribes to
  // declaration_completeness:getStatus when the user opens the declaration
  // and gets the full missing[] list.
  const rules = (await ctx.db
    .query("rule_definitions")
    .withIndex("by_enabled", (q: any) => q.eq("enabled", true))
    .collect()) as unknown as RuleDefinition[];
  const completeness = evaluateCompleteness({
    rules,
    declaration: declaration as Record<string, unknown>,
    items: items as Array<Record<string, unknown>>,
  });

  const replayedStatus = await effectiveDeclarationStatus(ctx, declarationId, {
    status: declaration.status,
    mrn: declaration.mrn,
    conversationId: declaration.conversationId,
  });

  const financialFields =
    declarationUserId
      ? await buildFinancialPreviewFields(
          ctx,
          declaration,
          declarationId,
          items,
          declarationUserId,
        )
      : {
          dutyAmount: undefined,
          vatAmount: undefined,
          customsValue: undefined,
          derivedDutyAmount: undefined,
          derivedVatAmount: undefined,
          financialSource: undefined,
          estimateMethod: undefined,
          estimateIncomplete: undefined,
          potentialPreferenceSaving: undefined,
          dmstaxUpdatedAt: undefined,
          defermentAccountNumber: undefined,
          paymentMethodLabel: undefined,
        };

  const nextPreview = {
    declarationId,
    userId: declarationUserId,
    orgId: orgIdFromDeclaration(declaration),
    status: replayedStatus,
    totalItems: items.length,
    totalValue,
    mrn: declaration.mrn ? String(declaration.mrn) : undefined,
    eori: declaration.eori ? String(declaration.eori) : undefined,
    declarationType: declaration.declarationType ? String(declaration.declarationType) : undefined,
    completenessReady: completeness.ready,
    missingCount: completeness.missing.length,
    ...financialFields,
    lastUpdated: Date.now(),
  };

  const isNew = !existingPreview;
  if (existingPreview) {
    const previewUnchanged = Object.entries(nextPreview).every(([key, value]) => {
      if (key === "lastUpdated") return true;
      return (existingPreview as Record<string, unknown>)[key] === value;
    });
    if (!previewUnchanged) {
      await ctx.db.patch(existingPreview._id, nextPreview);
    }
  } else {
    await ctx.db.insert("declaration_preview", nextPreview);
  }

  if (!declarationUserId) return;

  const summary = await ctx.db
    .query("dashboard_summary")
    .withIndex("by_user", (q: any) => q.eq("userId", declarationUserId))
    .first();

  if (!summary) {
    // Bootstrap on first write — full scan runs once per user, never again on hot paths.
    await recomputeDashboardSummaryByUser(ctx, declarationUserId);
    return;
  }

  const countDelta = isNew ? 1 : 0;
  const oldReview = isReviewStatus(existingPreview?.status);
  const newReview = isReviewStatus(nextPreview.status);
  const reviewDelta = (newReview ? 1 : 0) - (oldReview ? 1 : 0);
  const valueDelta = totalValue - (existingPreview?.totalValue || 0);

  if (countDelta !== 0 || reviewDelta !== 0 || valueDelta !== 0) {
    await ctx.db.patch(summary._id, {
      totalDeclarations: Math.max(0, (summary.totalDeclarations || 0) + countDelta),
      reviewCount: Math.max(0, (summary.reviewCount || 0) + reviewDelta),
      totalValue: Math.max(0, (summary.totalValue || 0) + valueDelta),
      updatedAt: Date.now(),
    });
  }
}

export const recomputeDashboardSummary = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await recomputeDashboardSummaryByUser(ctx, args.userId);
  },
});

/** HMRC intermediate states that should receive notification recovery if stale. */
const STUCK_HMRC_STATUSES = new Set([
  "processing",
  "amendment processing",
  "cancellation requested",
]);

export const getStuckProcessingDeclarations = internalQuery({
  args: { olderThanMs: v.number() },
  returns: v.array(
    v.object({
      _id: v.id("declarations"),
      userId: v.optional(v.string()),
      conversationId: v.optional(v.string()),
      status: v.optional(v.string()),
      lastUpdated: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.olderThanMs;
    const rows = await ctx.db.query("declarations").take(5000);
    const stuck = rows
      .filter(
        (r: any) =>
          STUCK_HMRC_STATUSES.has(String(r.status || "").toLowerCase()) &&
          Number(r.lastUpdated || r.created || 0) < cutoff,
      )
      .map((r: any) => ({
        _id: r._id,
        userId: r.userId || undefined,
        conversationId: r.conversationId || undefined,
        status: r.status || undefined,
        lastUpdated: Number(r.lastUpdated || r.created || 0),
      }));
    return stuck;
  },
});

export const getHmrcTokenForUser = internalQuery({
  args: { userId: v.string() },
  returns: v.union(v.object({ accessToken: v.optional(v.string()) }), v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (!row) return null;
    return { accessToken: row.accessToken };
  },
});

export const getHmrcTokenRowForUser = internalQuery({
  args: {
    userId: v.string(),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
  },
  returns: v.union(
    v.object({
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      accessTokenEncrypted: v.optional(v.string()),
      refreshTokenEncrypted: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      eori: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("hmrc_tokens")
      .withIndex("by_user_and_environment", (q: any) =>
        q.eq("userId", args.userId).eq("environment", args.environment),
      )
      .first();

    const legacySandbox =
      !row && args.environment === "sandbox"
        ? await ctx.db
            .query("hmrc_tokens")
            .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
            .first()
        : null;

    const tokenRow = row ?? legacySandbox;
    if (!tokenRow) return null;

    return {
      accessToken: tokenRow.accessToken,
      refreshToken: tokenRow.refreshToken,
      accessTokenEncrypted: tokenRow.accessTokenEncrypted,
      refreshTokenEncrypted: tokenRow.refreshTokenEncrypted,
      expiresAt: tokenRow.expiresAt,
      eori: tokenRow.eori,
    };
  },
});

export const upsertDeclarationPreview = internalMutation({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    await upsertDeclarationPreviewByDeclaration(ctx, args.declarationId);
  },
});

export const refreshRateCache = internalMutation({
  args: {
    userId: v.optional(v.string()),
    orgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.orgId) {
      const rows = await ctx.db
        .query("historical_declarations")
        .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
        .take(2000);
      const rateMap = buildRateMap(rows);
      const existing = await ctx.db
        .query("rate_cache")
        .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { rateMap, updatedAt: now });
      } else {
        await ctx.db.insert("rate_cache", {
          orgId: args.orgId,
          userId: args.userId,
          rateMap,
          updatedAt: now,
        });
      }
      return;
    }

    if (!args.userId) return;

    const rows = await ctx.db
      .query("historical_declarations")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .take(2000);
    const rateMap = buildRateMap(rows);
    const existing = await ctx.db
      .query("rate_cache")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { rateMap, updatedAt: now });
    } else {
      await ctx.db.insert("rate_cache", { userId: args.userId, rateMap, updatedAt: now });
    }
  },
});

async function getItemsByDeclarationForUser(ctx: any, userId: string, declarationIds: string[]) {
  if (declarationIds.length === 0) return new Map<string, any[]>();

  const allOwnedItems = await ctx.db
    .query("goods_items")
    .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
    .take(3000);

  const idSet = new Set(declarationIds.map((id) => String(id)));
  const grouped = new Map<string, any[]>();
  for (const item of allOwnedItems) {
    const key = String(item.declarationId || "");
    if (!idSet.has(key)) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  }

  const missingIds = declarationIds.filter((id) => !grouped.has(String(id)));
  if (missingIds.length > 0) {
    const legacyItems = await Promise.all(
      missingIds.map((id) =>
        ctx.db
          .query("goods_items")
          .withIndex("by_declaration", (q: any) => q.eq("declarationId", id))
          .take(500),
      ),
    );

    for (let i = 0; i < missingIds.length; i++) {
      const declId = String(missingIds[i]);
      const items = legacyItems[i] || [];
      grouped.set(declId, items);
    }
  }

  return grouped;
}

export const getLane = query({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declaration = await ctx.db.get(args.id);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return null;
    }

    const notificationRows = await collectDeclarationNotifications(ctx.db, {
      declarationId: args.id,
      conversationId: declaration.conversationId,
      mrn: declaration.mrn,
    });

    const status = replayDeclarationStatus(
      String(declaration.status ?? "Draft"),
      declaration.mrn,
      notificationRows,
    );

    const cdsBadge = resolveDeclarationCdsBadge(status, notificationRows);

    return { ...declaration, status, cdsBadgeLabel: cdsBadge.label, cdsBadgeTone: cdsBadge.tone };
  },
});

export const getDeclarationFinancialEstimate = query({
  args: { declarationId: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const declaration = await ctx.db.get(args.declarationId);
    if (!declaration || !(await canAccessDeclaration(ctx, identity.subject, declaration))) {
      return null;
    }

    try {
      const preview = await ctx.db
        .query("declaration_preview")
        .withIndex("by_declarationId", (q) => q.eq("declarationId", args.declarationId))
        .first();

      if (preview?.financialSource !== undefined) {
        return {
          declarationId: args.declarationId,
          dutyAmount: Number(preview.dutyAmount || 0),
          vatAmount: Number(preview.vatAmount || 0),
          customsValue: Number(preview.customsValue || 0),
          derivedDutyAmount: Number(preview.derivedDutyAmount || 0),
          derivedVatAmount: Number(preview.derivedVatAmount || 0),
          financialSource: preview.financialSource,
          estimateMethod: preview.estimateMethod,
          estimateIncomplete: preview.estimateIncomplete ?? false,
          potentialPreferenceSaving: preview.potentialPreferenceSaving ?? null,
          paymentMethodLabel: preview.paymentMethodLabel,
          defermentAccountNumber: preview.defermentAccountNumber,
          dmstaxUpdatedAt: preview.dmstaxUpdatedAt,
          updatedAt: preview.lastUpdated,
        };
      }

      const items = await ctx.db
        .query("goods_items")
        .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId))
        .take(500);

      const fields = await buildFinancialPreviewFields(
        ctx,
        declaration,
        args.declarationId,
        items,
        identity.subject,
      );

      return {
        declarationId: args.declarationId,
        dutyAmount: Number(fields.dutyAmount || 0),
        vatAmount: Number(fields.vatAmount || 0),
        customsValue: Number(fields.customsValue || 0),
        derivedDutyAmount: Number(fields.derivedDutyAmount || 0),
        derivedVatAmount: Number(fields.derivedVatAmount || 0),
        financialSource: fields.financialSource,
        estimateMethod: fields.estimateMethod,
        estimateIncomplete: fields.estimateIncomplete ?? false,
        potentialPreferenceSaving: fields.potentialPreferenceSaving ?? null,
        paymentMethodLabel: fields.paymentMethodLabel,
        defermentAccountNumber: fields.defermentAccountNumber,
        dmstaxUpdatedAt: fields.dmstaxUpdatedAt,
        updatedAt: Date.now(),
      };
    } catch {
      return null;
    }
  },
});

// Debug-only: list declarations for a userId without a Clerk session (test-evidence scripts).
export const listForDebug = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity) {
      return await ctx.db
        .query("declarations")
        .withIndex("by_user", (q: any) => q.eq("userId", identity.subject))
        .order("desc")
        .take(20);
    }

    if (process.env.ALLOW_DEBUG_CONVEX_QUERIES !== "true" || !args.userId) {
      return [];
    }

    return await ctx.db
      .query("declarations")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);
  },
});

// Debug-only query: used by test-evidence/debug-payload.js to fetch a declaration
// without a Clerk browser session. Requires ALLOW_DEBUG_CONVEX_QUERIES=true in dev.
export const getForDebug = query({
  args: { id: v.id("declarations"), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject
      ?? (process.env.ALLOW_DEBUG_CONVEX_QUERIES === "true" ? args.userId : undefined);
    if (!effectiveUserId) return null;

    const declaration = await ctx.db.get(args.id);
    if (!declaration) return null;
    if (String(declaration.userId ?? "") !== effectiveUserId) return null;
    return declaration;
  },
});

export const createDeclaration = mutation({
  args: {
    userId: v.string(),
    eori: v.optional(v.string()),
    route: v.optional(v.string()),
    declarationType: v.string(), // "H1", "B1" etc
    status: v.string(),
    initialItem: v.optional(v.object({
      originCountry: v.string(),
      hsCode: v.string(),
      description: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const { initialItem, ...declarationArgs } = args;
    const orgId = await resolveOrgIdForNewRecord(ctx, identity.subject);
    const declarationId = await ctx.db.insert("declarations", {
      ...declarationArgs,
      userId: identity.subject, // Override argument with identity
      ...(orgId ? { orgId } : {}),
      created: Date.now(),
      lastUpdated: Date.now(),
    });

    if (initialItem) {
      await ctx.db.insert("goods_items", {
        ownerId: identity.subject,
        declarationId: declarationId,
        sequenceNumber: 1,
        commodityCode: initialItem.hsCode,
        description: initialItem.description,
        originCountry: initialItem.originCountry,
        procedureCode: "4000",
        valueAmount: 0,
        valueCurrency: "GBP",
      });
    }

    await upsertDeclarationPreviewByDeclaration(ctx, declarationId);

    return declarationId;
  },
});

export const deleteDeclaration = mutation({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized: You do not own this declaration.");
    }

    // Read preview before deletion to capture delta values
    const existingPreview = await ctx.db
      .query("declaration_preview")
      .withIndex("by_declarationId", (q) => q.eq("declarationId", args.id))
      .first();

    // Delete associated goods items in parallel
    const items = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.id))
      .take(1000);
    await Promise.all(items.map((item) => ctx.db.delete(item._id)));

    await ctx.db.delete(args.id);
    if (existingPreview) await ctx.db.delete(existingPreview._id);

    // Apply delta to dashboard_summary instead of full rescan
    const summary = await ctx.db
      .query("dashboard_summary")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (summary) {
      const reviewDelta = isReviewStatus(existingPreview?.status) ? -1 : 0;
      const valueDelta = -(existingPreview?.totalValue || 0);
      await ctx.db.patch(summary._id, {
        totalDeclarations: Math.max(0, (summary.totalDeclarations || 0) - 1),
        reviewCount: Math.max(0, (summary.reviewCount || 0) + reviewDelta),
        totalValue: Math.max(0, (summary.totalValue || 0) + valueDelta),
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Atomically claim a declaration for submission. Prevents duplicate *live*
 * declarations caused by double-clicks or concurrent POSTs: the status is
 * read and flipped to "Processing" in one transaction, so a second call while
 * the first is in flight is rejected. Live declarations (Accepted/Amended)
 * must be amended, not re-submitted. Returns the prior status/MRN so the route
 * can revert if the HMRC call fails.
 */
export const beginSubmission = mutation({
  args: { id: v.id("declarations") },
  returns: v.object({ prevStatus: v.string(), prevMrn: v.string() }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized");
    }

    const status = String(existing.status ?? "Draft");
    const blocked = [
      "Processing",
      "Accepted",
      "Amended",
      "Amendment Processing",
      "Cancellation Requested",
    ];
    if (blocked.includes(status)) {
      throw new Error(
        `SUBMIT_BLOCKED: declaration is "${status}" — cannot submit. Amend a live declaration, or wait for the in-flight submission to finish.`,
      );
    }

    await ctx.db.patch(args.id, { status: "Processing", lastUpdated: Date.now() });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
    return { prevStatus: status, prevMrn: String(existing.mrn ?? "") };
  },
});

export const updateDeclarationStatus = mutation({
  args: {
    id: v.id("declarations"),
    status: v.string(),
    conversationId: v.optional(v.string()),
    mrn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized");
    }

    const patchObj: any = {
      status: args.status,
      lastUpdated: Date.now(),
    };
    if (args.conversationId) patchObj.conversationId = args.conversationId;
    // Clearing the MRN on re-submit (mrn: "") is intentional — HMRC assigns a
    // fresh MRN via DMSACC, so an empty string must overwrite the old value.
    if (args.mrn !== undefined) patchObj.mrn = args.mrn;

    await ctx.db.patch(args.id, patchObj);
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const updateDeclarationDetails = mutation({
  args: {
    id: v.id("declarations"),
    eori: v.string(),
    declarationType: v.string(),
    route: v.string(),
    dispatchCountry: v.optional(v.string()),
    destinationCountry: v.optional(v.string()),
    importerEori: v.optional(v.string()),
    presentationOffice: v.optional(v.string()),
    locationId: v.optional(v.string()),
    goodsLocationKind: v.optional(v.string()),
    goodsLocationTypeCode: v.optional(v.string()),
    goodsLocationQualifier: v.optional(v.string()),
    invoiceCurrency: v.optional(v.string()),
    invoiceTotal: v.optional(v.union(v.number(), v.null())),
    incoterms: v.optional(v.string()),
    incotermLocation: v.optional(v.string()),
    transportMode: v.optional(v.string()),
    transportId: v.optional(v.string()),
    transportIdType: v.optional(v.string()),
    exporterName: v.optional(v.string()),
    exporterCity: v.optional(v.string()),
    exporterLine: v.optional(v.string()),
    exporterPostcode: v.optional(v.string()),
    transactionNatureCode: v.optional(v.string()),
    defermentAccountNumber: v.optional(v.string()),
    paymentMethodCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized");
    }

    const mop = String(args.paymentMethodCode ?? "").trim().toUpperCase();
    const danDigits = String(args.defermentAccountNumber ?? "").replace(/\D/g, "");
    const dan = danDigits.length === 7 ? danDigits : "";
    const defermentMops = new Set(["E", "R"]);

    if (defermentMops.has(mop) && !dan) {
      throw new Error("Deferment account number (DE 2/6) is required when method of payment is E or R.");
    }
    if (dan && !defermentMops.has(mop)) {
      throw new Error("Method of payment must be E or R when a deferment account number is provided.");
    }
    if (String(args.defermentAccountNumber ?? "").trim() && !dan) {
      throw new Error("Deferment account number must be exactly 7 digits (DE 2/6).");
    }

    await ctx.db.patch(args.id, {
      eori: args.eori,
      declarationType: args.declarationType,
      route: args.route,
      ...(args.dispatchCountry !== undefined ? { dispatchCountry: args.dispatchCountry } : {}),
      ...(args.destinationCountry !== undefined ? { destinationCountry: args.destinationCountry } : {}),
      ...(args.importerEori !== undefined ? { importerEori: args.importerEori } : {}),
      ...(args.presentationOffice !== undefined ? { presentationOffice: args.presentationOffice } : {}),
      ...(args.locationId !== undefined ? { locationId: args.locationId } : {}),
      ...(args.goodsLocationKind !== undefined ? { goodsLocationKind: args.goodsLocationKind } : {}),
      ...(args.goodsLocationTypeCode !== undefined ? { goodsLocationTypeCode: args.goodsLocationTypeCode } : {}),
      ...(args.goodsLocationQualifier !== undefined ? { goodsLocationQualifier: args.goodsLocationQualifier } : {}),
      ...(args.invoiceCurrency !== undefined ? { invoiceCurrency: args.invoiceCurrency } : {}),
      ...(args.invoiceTotal !== undefined ? { invoiceTotal: args.invoiceTotal } : {}),
      ...(args.incoterms !== undefined ? { incoterms: args.incoterms } : {}),
      ...(args.incotermLocation !== undefined ? { incotermLocation: args.incotermLocation } : {}),
      ...(args.transportMode !== undefined ? { transportMode: args.transportMode } : {}),
      ...(args.transportId !== undefined ? { transportId: args.transportId } : {}),
      ...(args.transportIdType !== undefined ? { transportIdType: args.transportIdType } : {}),
      ...(args.exporterName !== undefined ? { exporterName: args.exporterName } : {}),
      ...(args.exporterCity !== undefined ? { exporterCity: args.exporterCity } : {}),
      ...(args.exporterLine !== undefined ? { exporterLine: args.exporterLine } : {}),
      ...(args.exporterPostcode !== undefined ? { exporterPostcode: args.exporterPostcode } : {}),
      ...(args.transactionNatureCode !== undefined ? { transactionNatureCode: args.transactionNatureCode } : {}),
      ...(args.defermentAccountNumber !== undefined
        ? { defermentAccountNumber: dan || undefined }
        : {}),
      ...(args.paymentMethodCode !== undefined
        ? { paymentMethodCode: mop || undefined }
        : {}),
      lastUpdated: Date.now(),
    });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const setDeclarationMode = mutation({
  args: {
    id: v.id("declarations"),
    mode: v.union(v.literal("minimal"), v.literal("enriched")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.id, { mode: args.mode, lastUpdated: Date.now() });
    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
    return { mode: args.mode };
  },
});

// One-off backfill for transport (DE 7/4, 7/7, 7/9) + lane mode. Used when a
// declaration was created before these fields existed on the form. Runs as
// internal so we can invoke it from `npx convex run` without auth juggling.
export const backfillTransportAndMode = internalMutation({
  args: {
    id: v.id("declarations"),
    transportMode: v.optional(v.string()),
    transportId: v.optional(v.string()),
    transportIdType: v.optional(v.string()),
    mode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error(`Declaration ${args.id} not found`);
    const patch: Record<string, unknown> = { lastUpdated: Date.now() };
    if (args.transportMode !== undefined) patch.transportMode = args.transportMode;
    if (args.transportId !== undefined) patch.transportId = args.transportId;
    if (args.transportIdType !== undefined) patch.transportIdType = args.transportIdType;
    if (args.mode !== undefined) patch.mode = args.mode;
    await ctx.db.patch(args.id, patch);
    return { id: args.id, applied: patch };
  },
});

export const populateDemoData = mutation({
  args: { id: v.id("declarations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db.get(args.id);
    if (!existing || !(await canAccessDeclaration(ctx, identity.subject, existing))) {
      throw new Error("Unauthorized");
    }

    // 1. Update header to satisfy validation
    await ctx.db.patch(args.id, {
      eori: "GB664653557000",
      declarationType: "IM",
      route: "Route 1",
    });

    // 2. Check if items exist, if not, add the dummy invoice item
    const existingItems = await ctx.db
      .query("goods_items")
      .withIndex("by_declaration", (q) => q.eq("declarationId", args.id))
      .take(1);

    if (existingItems.length === 0) {
      await ctx.db.insert("goods_items", {
        ownerId: identity.subject,
        declarationId: args.id,
        sequenceNumber: 1,
        commodityCode: "6109100010",
        description: "Men's knitted cotton t-shirts",
        originCountry: "GB",
        procedureCode: "4000",
        valueAmount: 12500.0,
        valueCurrency: "GBP",
        grossWeightKg: 150,
        netWeightKg: 145,
      });
    }

    await upsertDeclarationPreviewByDeclaration(ctx, args.id);
  },
});

export const getAllDecls = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(args.limit ?? 300, 1), 1000);
    return await ctx.db.query("declarations").order("desc").take(limit);
  }
});

export const getMyDeclarations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await listDeclarationsForTenant(ctx, identity.subject, 200);
  }
});

export const getMyDeclarationCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { total: 0, reviewCount: 0 };

    const previews = await listDeclarationPreviewsForTenant(ctx, identity.subject, 500);

    if (previews.length === 0) {
      const activeOrgId = await getActiveOrgId(ctx, identity.subject);
      if (activeOrgId) return { total: 0, reviewCount: 0 };

      const summary = await ctx.db
        .query("dashboard_summary")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .first();
      if (!summary) return { total: 0, reviewCount: 0 };
      return { total: summary.totalDeclarations, reviewCount: summary.reviewCount };
    }

    let reviewCount = 0;
    for (const preview of previews) {
      if (isReviewStatus(String(preview.status ?? ""))) reviewCount += 1;
    }

    return { total: previews.length, reviewCount };
  },
});

export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const previews = await listDeclarationPreviewsForTenant(ctx, identity.subject, 500);

    if (previews.length > 0) {
      let reviewCount = 0;
      let totalValue = 0;
      for (const preview of previews) {
        if (isReviewStatus(String(preview.status || "Draft"))) reviewCount += 1;
        totalValue += Number(preview.totalValue || 0);
      }

      return {
        userId: identity.subject,
        totalDeclarations: previews.length,
        reviewCount,
        totalValue,
        updatedAt: 0,
      };
    }

    const activeOrgId = await getActiveOrgId(ctx, identity.subject);
    if (activeOrgId) {
      return {
        userId: identity.subject,
        totalDeclarations: 0,
        reviewCount: 0,
        totalValue: 0,
        updatedAt: 0,
      };
    }

    const summary = await ctx.db
      .query("dashboard_summary")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (summary) return summary;

    const declarations = await listDeclarationsForTenant(ctx, identity.subject, 200);

    let reviewCount = 0;
    for (const declaration of declarations) {
      if (isReviewStatus(String(declaration.status || "Draft"))) {
        reviewCount += 1;
      }
    }

    return {
      userId: identity.subject,
      totalDeclarations: declarations.length,
      reviewCount,
      totalValue: 0,
      updatedAt: 0,
    };
  },
});

export const getDashboardAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject;

    const previews = await listDeclarationPreviewsForTenant(ctx, userId, 200);

    const cutoff = Date.now() - THIRTY_DAYS_MS;
    let totalDuty = 0;
    let dutyDeclarationCount = 0;
    const dutyByHs = new Map<string, number>();
    const dutyByDeclarationId: Record<string, number> = {};
    const overpayments: Array<{
      title: string;
      subtitle: string;
      amount: number;
      declarationId: string;
    }> = [];

    const recentDutyPreviewIds: string[] = [];

    for (const preview of previews) {
      const declId = String(preview.declarationId);
      const duty = Number(preview.dutyAmount || 0);
      const derivedDuty = Number(preview.derivedDutyAmount || 0);
      const confirmed = preview.financialSource === "hmrc_confirmed";

      if (duty > 0) {
        dutyByDeclarationId[declId] = duty;
      }

      const updatedAt = Number(preview.lastUpdated || 0);
      if (updatedAt >= cutoff && duty > 0) {
        totalDuty += duty;
        dutyDeclarationCount += 1;
        recentDutyPreviewIds.push(declId);
      }

      const decl = await ctx.db.get(preview.declarationId);
      const savingsEstimate = Number(decl?.savingsEstimate || 0);
      if (savingsEstimate > 0) {
        overpayments.push({
          title: String(preview.mrn || decl?.mrn || "Draft declaration"),
          subtitle: FL.savingsOpportunity,
          amount: savingsEstimate,
          declarationId: declId,
        });
        continue;
      }

      if (confirmed && derivedDuty > duty + 0.01) {
        overpayments.push({
          title: String(preview.mrn || decl?.mrn || "Draft declaration"),
          subtitle: FL.estimateHigherThanHmrc,
          amount: derivedDuty - duty,
          declarationId: declId,
        });
      }
    }

    if (recentDutyPreviewIds.length > 0) {
      const itemsByDeclaration = await getItemsByDeclarationForUser(
        ctx,
        userId,
        recentDutyPreviewIds,
      );
      for (const declId of recentDutyPreviewIds) {
        const preview = previews.find((p) => String(p.declarationId) === declId);
        const duty = Number(preview?.dutyAmount || 0);
        if (duty <= 0) continue;
        const items = itemsByDeclaration.get(declId) || [];
        const totalVal = items.reduce(
          (sum, item) => sum + Number(item.valueAmount || 0),
          0,
        );
        if (totalVal <= 0) continue;
        for (const item of items) {
          const code = String(item.commodityCode || "").trim().slice(0, 4);
          if (!code) continue;
          const itemVal = Number(item.valueAmount || 0);
          if (itemVal <= 0) continue;
          const share = duty * (itemVal / totalVal);
          dutyByHs.set(code, (dutyByHs.get(code) || 0) + share);
        }
      }
    }

    const chartData = [...dutyByHs.entries()]
      .map(([code, duty]) => ({ code, duty: Number(duty.toFixed(2)) }))
      .sort((a, b) => b.duty - a.duty)
      .slice(0, 8);

    overpayments.sort((a, b) => b.amount - a.amount);

    return {
      totalDuty: Number(totalDuty.toFixed(2)),
      avgDuty:
        dutyDeclarationCount > 0
          ? Number((totalDuty / dutyDeclarationCount).toFixed(2))
          : 0,
      chartData,
      overpayments: overpayments.slice(0, 5),
      dutyByDeclarationId,
    };
  },
});

export const getDeclarationPreviews = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const previews = await listDeclarationPreviewsForTenant(ctx, identity.subject, 200);

    if (previews.length > 0) {
      return previews;
    }

    const declarations = await listDeclarationsForTenant(ctx, identity.subject, 200);

    return declarations
      .map((declaration) => ({
        declarationId: declaration._id,
        userId: String(declaration.userId ?? identity.subject),
        orgId: orgIdFromDeclaration(declaration),
        status: String(declaration.status ?? "Draft"),
        totalItems: 0,
        totalValue: 0,
        mrn: declaration.mrn ? String(declaration.mrn) : undefined,
        eori: declaration.eori ? String(declaration.eori) : undefined,
        declarationType: declaration.declarationType
          ? String(declaration.declarationType)
          : undefined,
        lastUpdated: Number(
          declaration.lastUpdated || declaration.created || declaration._creationTime || 0,
        ),
      }))
      .sort((a, b) => b.lastUpdated - a.lastUpdated);
  },
});

export const rebuildMyReadModels = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const declarations = await listDeclarationsForTenant(ctx, identity.subject, 5000);

    await Promise.all(declarations.map((d) => upsertDeclarationPreviewByDeclaration(ctx, d._id)));

    await recomputeDashboardSummaryByUser(ctx, identity.subject);

    return {
      declarationCount: declarations.length,
      rebuiltAt: Date.now(),
    };
  },
});

// Debug-only: rebuild declaration previews + dashboard summary for a known user
// without requiring an interactive Clerk session in the terminal.
export const rebuildReadModelsForDebug = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const declarations = await ctx.db
      .query("declarations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .take(5000);

    await Promise.all(declarations.map((d) => upsertDeclarationPreviewByDeclaration(ctx, d._id)));
    await recomputeDashboardSummaryByUser(ctx, args.userId);

    return {
      declarationCount: declarations.length,
      rebuiltAt: Date.now(),
      userId: args.userId,
    };
  },
});

export const getReports = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decls = await listDeclarationsForTenant(ctx, identity.subject, 150);

    const historicalRates = await getHistoricalRateMap(ctx, identity.subject);
    const reports = [];
    const declarationIds = decls.map((decl) => String(decl._id));
    const itemsByDeclaration = await getItemsByDeclarationForUser(ctx, identity.subject, declarationIds);
    const notificationsByDeclaration = await buildNotificationsByDeclaration(ctx, identity.subject);
    const lrnByDeclaration = await buildSubmitLrnByDeclaration(ctx, identity.subject);
    const allItems = [...itemsByDeclaration.values()].flat();
    const tariffByCommodityCode = await loadTariffCachesForCommodityCodes(
      ctx,
      allItems.map((item) => String(item?.commodityCode || "")),
    );

    for (const decl of decls) {
      const items = itemsByDeclaration.get(String(decl._id)) || [];
      const declarationNotifications = notificationsByDeclaration.get(String(decl._id)) || [];
      const financials = computeDeclarationFinancials(
        items,
        declarationNotifications,
        historicalRates,
        tariffByCommodityCode,
      );

      let totalValue = 0;
      const mappedItems = items.slice(0, 50).map((item, idx) => {
        const val = Number(item.valueAmount || 0);
        const { itemDuty, itemVat } = estimateItemFinancials(item, historicalRates, tariffByCommodityCode);
        totalValue += val;

        return {
          sequence: item.sequenceNumber || (idx + 1),
          commodityCode: item.commodityCode || "Unknown",
          description: item.description || "No description",
          netMass: item.netWeightKg ? `${item.netWeightKg} kg` : "N/A",
          cpc: item.procedureCode || "4000 000",
          itemPrice: `GBP ${val.toFixed(2)}`,
          customsValue: `GBP ${val.toFixed(2)}`,
          dutyPaid: `£${itemDuty.toFixed(2)}`,
          vatAmount: `£${itemVat.toFixed(2)}`,
        };
      });

      const hmrcStatus = hmrcStatusForDeclaration(decl, declarationNotifications);
      const isAuthoritative =
        isHmrcConfirmedDeclaration(decl, declarationNotifications) || financials.hasConfirmedFinancials;
      const totalDutyAndVat = financials.duty + financials.vat;
      const acceptanceNotification = declarationNotifications.find(
        (n) => String(n.notificationType || "").toUpperCase() === "DMSACC",
      );
      const clearanceNotification = declarationNotifications.find(
        (n) => String(n.notificationType || "").toUpperCase() === "DMSCLE",
      );

      reports.push({
        id: decl._id,
        mrn: decl.mrn ? String(decl.mrn) : "Draft",
        date: new Date(decl.created || Date.now()).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        broker: displayOrDash(decl.eori),
        score: hmrcStatus.score,
        status: hmrcStatus.status,
        ducr: "—",
        lrn: lrnByDeclaration.get(String(decl._id)) || displayOrDash(decl.conversationId),
        importer: displayOrDash(decl.importerEori || decl.eori),
        declarant: displayOrDash(decl.eori),
        consignor: formatConsignor(decl),
        dispatchCountry: displayOrDash(decl.dispatchCountry || items[0]?.originCountry),
        originCountry: displayOrDash(items[0]?.originCountry || decl.originCountry),
        portCode: displayOrDash(decl.locationId || decl.route),
        acceptanceDate: acceptanceNotification?.issueDateTime
          ? new Date(acceptanceNotification.issueDateTime).toLocaleString("en-GB")
          : new Date(decl.created || Date.now()).toLocaleString("en-GB"),
        clearanceDate: clearanceNotification?.issueDateTime
          ? new Date(clearanceNotification.issueDateTime).toLocaleString("en-GB")
          : decl.status === "Cleared" || decl.status === "Accepted"
            ? new Date(decl.lastUpdated || Date.now()).toLocaleString("en-GB")
            : "Pending",
        totalInvoiceValue: `GBP ${totalValue.toFixed(2)}`,
        totalCustomsValue: `GBP ${totalValue.toFixed(2)}`,
        totalDutyAndVat: `GBP ${totalDutyAndVat.toFixed(2)}`,
        items: mappedItems,
        provenance: isAuthoritative ? "hmrc_confirmed" : "derived",
        provenanceLabel: financials.hasConfirmedFinancials
          ? FL.reportConfirmed
          : isAuthoritative
            ? FL.reportStatusConfirmed
            : FL.reportEstimated,
        isAuthoritative,
      });
    }

    return reports;
  }
});

export const getFinancialRecords = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const decls = await listDeclarationsForTenant(ctx, identity.subject, 200);

    const historicalRates = await getHistoricalRateMap(ctx, identity.subject);
    const records: FinancialRecord[] = [];
    const declarationIds = decls.map((decl) => String(decl._id));
    const itemsByDeclaration = await getItemsByDeclarationForUser(ctx, identity.subject, declarationIds);
    const notificationsByDeclaration = await buildNotificationsByDeclaration(ctx, identity.subject);
    const allItems = [...itemsByDeclaration.values()].flat();
    const tariffByCommodityCode = await loadTariffCachesForCommodityCodes(
      ctx,
      allItems.map((item) => String(item?.commodityCode || "")),
    );

    const previews = await listDeclarationPreviewsForTenant(ctx, identity.subject, 500);
    const previewByDeclarationId = new Map(
      previews.map((preview) => [String(preview.declarationId), preview]),
    );

    for (const decl of decls) {
      if (decl.status === "Draft" || !decl.mrn) continue;

      const preview = previewByDeclarationId.get(String(decl._id));
      let financials: ReturnType<typeof computeDeclarationFinancials>;
      let payment: { label: string; accountNumber: string };

      if (preview?.financialSource !== undefined) {
        financials = financialsFromPreview(preview);
        payment = {
          label:
            preview.paymentMethodLabel ||
            resolvePaymentMethodLabel(decl, financials.hasConfirmedFinancials).label,
          accountNumber: preview.defermentAccountNumber || "—",
        };
      } else {
        const items = itemsByDeclaration.get(String(decl._id)) || [];
        const declarationNotifications = notificationsByDeclaration.get(String(decl._id)) || [];
        financials = computeDeclarationFinancials(
          items,
          declarationNotifications,
          historicalRates,
          tariffByCommodityCode,
        );
        payment = resolvePaymentMethodLabel(decl, financials.hasConfirmedFinancials);
      }

      records.push(...buildFinancialRecordsForDeclaration(decl, financials, payment));
    }
    return records;
  },
});
