import { query } from "./_generated/server";
import { getActiveOrgId } from "./lib/org_access";

const MAX_ROWS = 1000;

export interface TreAuditFinding {
  id: string;
  severity: "advisory" | "review";
  category: "hs_consistency" | "history_gap" | "preference_docs";
  title: string;
  detail: string;
  mrn?: string;
}

/**
 * Deterministic TRE history audits (no AI).
 * Flags HS spread, declaration history gaps, and preference without documents.
 */
export const listAuditFindings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return emptyAudit();
    }

    const orgId = await getActiveOrgId(ctx, identity.subject);
    const rows = orgId
      ? await ctx.db
          .query("historical_declarations")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .order("desc")
          .take(MAX_ROWS)
      : await ctx.db
          .query("historical_declarations")
          .withIndex("by_user", (q) => q.eq("userId", identity.subject))
          .order("desc")
          .take(MAX_ROWS);

    if (rows.length === 0) return emptyAudit();

    const findings: TreAuditFinding[] = [];

    const byOriginHeading = new Map<string, Set<string>>();
    for (const row of rows) {
      const origin = String(row.countryOfOriginCode ?? "").trim().toUpperCase();
      const code = String(row.commodityCode ?? "").replace(/\D/g, "");
      if (!/^[A-Z]{2}$/.test(origin) || code.length < 6) continue;
      const heading = code.slice(0, 6);
      const key = `${origin}:${heading}`;
      if (!byOriginHeading.has(key)) byOriginHeading.set(key, new Set());
      if (code.length === 10) byOriginHeading.get(key)!.add(code);
    }

    for (const [key, codes] of byOriginHeading) {
      if (codes.size < 2) continue;
      const [origin, heading] = key.split(":");
      findings.push({
        id: `hs-${key}`,
        severity: "review",
        category: "hs_consistency",
        title: "Multiple HS codes under same heading",
        detail: `Origin ${origin}: heading ${heading} appears with ${codes.size} different 10-digit codes (${[...codes].slice(0, 4).join(", ")}${codes.size > 4 ? "…" : ""}). Review whether the same goods were classified differently.`,
      });
    }

    const acceptanceDates = rows
      .map((r) => parseAcceptanceDate(String(r.acceptanceDate ?? "")))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    if (acceptanceDates.length >= 2) {
      const first = acceptanceDates[0];
      const last = acceptanceDates[acceptanceDates.length - 1];
      const monthSet = new Set(acceptanceDates.map((d) => monthKey(d)));
      let cursor = new Date(first.getFullYear(), first.getMonth(), 1);
      const end = new Date(last.getFullYear(), last.getMonth(), 1);
      while (cursor <= end) {
        const key = monthKey(cursor);
        if (!monthSet.has(key)) {
          findings.push({
            id: `gap-${key}`,
            severity: "advisory",
            category: "history_gap",
            title: "No imports in period",
            detail: `No acceptance dates in ${formatMonth(cursor)} between your earliest and latest TRE rows. Check whether declarations were filed under another EORI or missing from this export.`,
          });
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    for (const row of rows) {
      if (row.reportKind && row.reportKind !== "import_item") continue;
      const pref = String(row.preferenceCode ?? "").trim();
      if (!pref || pref === "100") continue;
      const docs = String(row.documentCodes ?? "").trim();
      if (docs) continue;
      const mrn = String(row.entryIdentifierMrn ?? "");
      findings.push({
        id: `pref-doc-${row.sourceRowHash ?? mrn}`,
        severity: "advisory",
        category: "preference_docs",
        title: "Preference without document reference",
        detail: `MRN ${mrn}: preference code ${pref} with no document code in the TRE row. Confirm preference evidence was attached.`,
        mrn,
      });
    }

    return {
      generatedAt: Date.now(),
      totalRowsScanned: rows.length,
      findingCount: findings.length,
      findings: findings.slice(0, 50),
      disclaimer:
        "Deterministic checks on imported TRE data only. Not a compliance determination — review flagged rows against invoices and HMRC records.",
    };
  },
});

function emptyAudit() {
  return {
    generatedAt: Date.now(),
    totalRowsScanned: 0,
    findingCount: 0,
    findings: [] as TreAuditFinding[],
    disclaimer:
      "Deterministic checks on imported TRE data only. Not a compliance determination — review flagged rows against invoices and HMRC records.",
  };
}

export function parseAcceptanceDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const uk = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (uk) {
    const day = Number(uk[1]);
    const month = Number(uk[2]);
    const year = Number(uk[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return null;
  }

  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
