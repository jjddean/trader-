"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { parseTariffResponse, type TariffJsonApi } from "../lib/tariff_parser";

const TARIFF_BASE = "https://www.trade-tariff.service.gov.uk/uk/api/commodities";

// Fetch a commodity's tariff data, cache the raw JSON, parse measures into
// rule_definitions, and link the derived ruleIds back to the cache row so
// the next refresh can disable rules that no longer appear in the API.
//
// Invoke from CLI:
//   npx convex run actions/tariff:refreshCommodity '{"commodityCode":"8471300000"}'
export const refreshCommodity = internalAction({
  args: { commodityCode: v.string() },
  handler: async (ctx, args) => {
    const code = args.commodityCode.replace(/\s+/g, "");
    if (!/^\d{10}$/.test(code)) {
      throw new Error(`commodityCode must be 10 digits, got "${code}"`);
    }
    const url = `${TARIFF_BASE}/${code}`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.hmrc.2.0+json" },
    });
    if (!res.ok) {
      throw new Error(`Tariff API ${res.status}: ${await res.text().catch(() => "")}`);
    }
    const raw = (await res.json()) as TariffJsonApi;
    const fetchedAtIso = new Date().toISOString().slice(0, 10);
    const parsed = parseTariffResponse(raw, fetchedAtIso);

    const ruleIds = parsed.map((r) => r.ruleId);
    await ctx.runMutation(internal.tariff_internal.upsertCacheAndRules, {
      commodityCode: code,
      sourceUrl: url,
      rawResponse: raw,
      derivedRuleIds: ruleIds,
      rules: parsed,
    });

    return {
      commodityCode: code,
      measures: raw.data.relationships?.import_measures?.data?.length ?? 0,
      rulesGenerated: parsed.length,
      ruleIds,
    };
  },
});
