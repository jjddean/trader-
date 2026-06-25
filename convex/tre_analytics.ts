import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { getActiveOrgId } from "./lib/org_access";
import { evaluatePreferenceOptions } from "./lib/duty_rate_parser";
import type { TariffJsonApi } from "./lib/tariff_parser";
import {
  evaluateRowOpportunity,
  isPreferenceClaimed,
  type TreOpportunity,
} from "./lib/tre_opportunity";

// Probe customs value used to derive ad-valorem percentages from the tariff
// measures once per (commodity, origin) lane, then scaled to each row's real
// customs value. Specific (per-weight) duties come back as incompleteInput —
// TRE rows carry no net weight, so those lanes are skipped (no flag).
const PROBE_CUSTOMS_VALUE = 100;

const MAX_ROWS_SCANNED = 1000;
const MAX_OPPORTUNITIES_RETURNED = 200;

interface LaneRates {
  mfnPct: number | null;
  prefPct: number | null;
  mfnRateLabel: string;
  preferenceRateLabel: string;
  preferenceGeoDescription: string;
  requiresProofOfOrigin: boolean;
  measureSource: string;
}

async function loadTariffDoc(
  ctx: Pick<QueryCtx, "db">,
  commodityCode: string,
): Promise<TariffJsonApi | null> {
  const row = await ctx.db
    .query("tariff_cache")
    .withIndex("by_commodity", (q) => q.eq("commodityCode", commodityCode))
    .first();
  return (row?.rawResponse as TariffJsonApi) ?? null;
}

/** Derive MFN vs cheapest-preference ad-valorem rates for a lane (deterministic). */
function computeLaneRates(doc: TariffJsonApi, origin: string): LaneRates | null {
  const evaluation = evaluatePreferenceOptions(doc, {
    originCountry: origin,
    input: { customsValueGbp: PROBE_CUSTOMS_VALUE },
  });
  if (!evaluation) return null;

  const mfn = evaluation.options.find((o) => o.isMfn) ?? evaluation.mfn;
  const prefOptions = evaluation.options
    .filter((o) => o.isPreference && !o.incompleteInput)
    .sort((a, b) => a.dutyAmount - b.dutyAmount);
  const cheapestPref = prefOptions[0] ?? null;

  const mfnPct = mfn && !mfn.incompleteInput ? mfn.dutyAmount / PROBE_CUSTOMS_VALUE : null;
  const prefPct = cheapestPref ? cheapestPref.dutyAmount / PROBE_CUSTOMS_VALUE : null;

  return {
    mfnPct,
    prefPct,
    mfnRateLabel: mfn?.rateLabel ?? "",
    preferenceRateLabel: cheapestPref?.rateLabel ?? "",
    preferenceGeoDescription: cheapestPref?.geographicalAreaDescription ?? "",
    requiresProofOfOrigin: (cheapestPref?.certificates.length ?? 0) > 0,
    measureSource: cheapestPref?.source ?? mfn?.source ?? "",
  };
}

/**
 * TRE preference opportunities (flag only).
 *
 * Deterministic: compares Trade Tariff MFN vs preferential measures for rows
 * that paid MFN duty without claiming preference. No AI. Org-scoped. The
 * `indicativeTotalDelta` is non-binding and must be labelled as an estimate in
 * the UI — it is NOT a reclaim amount.
 */
export const listOpportunities = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return emptyResult();
    }

    const orgId = await getActiveOrgId(ctx, identity.subject);

    const rows = orgId
      ? await ctx.db
          .query("historical_declarations")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .order("desc")
          .take(MAX_ROWS_SCANNED)
      : await ctx.db
          .query("historical_declarations")
          .withIndex("by_user", (q) => q.eq("userId", identity.subject))
          .order("desc")
          .take(MAX_ROWS_SCANNED);

    if (rows.length === 0) return emptyResult();

    // Candidate rows: no preference claimed, valid origin + 10-digit commodity.
    const candidates = rows.filter((row) => {
      if (isPreferenceClaimed(row.preferenceCode ? String(row.preferenceCode) : "")) return false;
      const origin = String(row.countryOfOriginCode ?? "").trim().toUpperCase();
      const commodity = String(row.commodityCode ?? "").trim();
      const value = Number(row.itemCustomsValue ?? 0);
      return /^[A-Z]{2}$/.test(origin) && commodity.length === 10 && value > 0;
    });

    // Resolve lane rates once per (commodity, origin), reusing the tariff doc.
    const laneCache = new Map<string, LaneRates | null>();
    const docCache = new Map<string, TariffJsonApi | null>();
    const opportunities: Array<TreOpportunity & { mrn: string }> = [];

    for (const row of candidates) {
      const origin = String(row.countryOfOriginCode).trim().toUpperCase();
      const commodity = String(row.commodityCode).trim();
      const laneKey = `${commodity}:${origin}`;

      let lane = laneCache.get(laneKey);
      if (lane === undefined) {
        let doc = docCache.get(commodity);
        if (doc === undefined) {
          doc = await loadTariffDoc(ctx, commodity);
          docCache.set(commodity, doc);
        }
        lane = doc ? computeLaneRates(doc, origin) : null;
        laneCache.set(laneKey, lane);
      }

      if (!lane || lane.mfnPct == null || lane.prefPct == null) continue;

      const customsValue = Number(row.itemCustomsValue);
      const opportunity = evaluateRowOpportunity({
        preferenceCode: row.preferenceCode ? String(row.preferenceCode) : "",
        countryOfOriginCode: origin,
        commodityCode: commodity,
        itemCustomsValue: customsValue,
        acceptanceDate: row.acceptanceDate ? String(row.acceptanceDate) : undefined,
        mfnDutyAmount: lane.mfnPct * customsValue,
        preferenceDutyAmount: lane.prefPct * customsValue,
        mfnRateLabel: lane.mfnRateLabel,
        preferenceRateLabel: lane.preferenceRateLabel,
        preferenceGeoDescription: lane.preferenceGeoDescription,
        requiresProofOfOrigin: lane.requiresProofOfOrigin,
        measureSource: lane.measureSource,
      });

      if (opportunity) {
        opportunities.push({
          ...opportunity,
          mrn: String(row.entryIdentifierMrn ?? "—"),
        });
      }
    }

    opportunities.sort((a, b) => b.indicativeDelta - a.indicativeDelta);
    const trimmed = opportunities.slice(0, MAX_OPPORTUNITIES_RETURNED);
    const indicativeTotalDelta =
      Math.round(opportunities.reduce((sum, o) => sum + o.indicativeDelta, 0) * 100) / 100;

    return {
      generatedAt: Date.now(),
      totalRowsScanned: rows.length,
      candidateCount: candidates.length,
      opportunityCount: opportunities.length,
      indicativeTotalDelta,
      opportunities: trimmed,
      // Compliance: never present as recoverable. UI must label as indicative.
      disclaimer:
        "Indicative only. Identifies declarations where a preferential rate may have applied. " +
        "Not a reclaim amount and not a guarantee of eligibility — HMRC determines repayment (C285).",
    };
  },
});

function emptyResult() {
  return {
    generatedAt: Date.now(),
    totalRowsScanned: 0,
    candidateCount: 0,
    opportunityCount: 0,
    indicativeTotalDelta: 0,
    opportunities: [] as Array<TreOpportunity & { mrn: string }>,
    disclaimer:
      "Indicative only. Identifies declarations where a preferential rate may have applied. " +
      "Not a reclaim amount and not a guarantee of eligibility — HMRC determines repayment (C285).",
  };
}
