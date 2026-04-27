"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Source: github.com/hmrc/wco-dec — JSON code lists used by HMRC's own
// CDS reference implementation. We pin to `main` so this re-runs against
// whatever HMRC publishes, but the seed action should be invoked manually
// (or on a slow schedule) and the loaded values reviewed via listCodes.
const RAW_BASE =
  "https://raw.githubusercontent.com/hmrc/wco-dec/main/src/main/resources/uk/gov/hmrc/wco/dec";

// listName → source file. Names mirror what the mapper validator looks up.
// WCO procedures are split into TWO 2-digit codes: current ("40") + previous ("00").
// `additional_procedure_codes` (UK 3-digit Y/9xx series) is HMRC-specific and not in
// the WCO repo — defer until the UK Tariff API is wired in Stage 2.
const SOURCES: Array<{ listName: string; file: string }> = [
  { listName: "additional_documents", file: "allowed-additional-documents.json" },
  { listName: "customs_offices", file: "customs-offices.json" },
  { listName: "auth_categories", file: "party-role-authorization-types.json" },
  { listName: "valuation_methods", file: "valuation-method-types.json" },
  { listName: "package_types", file: "package-types.json" },
  { listName: "transport_modes", file: "transport-mode-types.json" },
  { listName: "transport_id_types", file: "transport-means-identification-types.json" },
  { listName: "incoterms", file: "incoterm-codes.json" },
  { listName: "previous_document_types", file: "import-previous-documents.json" },
  { listName: "procedure_codes", file: "government-procedure-types.json" },
  { listName: "previous_procedure_codes", file: "import-previous-procedures.json" },
];

type RawEntry = { value?: unknown; display?: unknown; description?: unknown } & Record<string, unknown>;

function normaliseEntry(raw: RawEntry): { value: string; description: string; metadata?: unknown } | null {
  const value = typeof raw.value === "string" ? raw.value.trim() : "";
  if (!value) return null;
  const description =
    (typeof raw.display === "string" && raw.display) ||
    (typeof raw.description === "string" && raw.description) ||
    "";
  const { value: _v, display: _d, description: _desc, ...rest } = raw;
  return {
    value,
    description: String(description),
    metadata: Object.keys(rest).length > 0 ? rest : undefined,
  };
}

export const seedHmrcCodeLists = internalAction({
  handler: async (ctx) => {
    const summary: Array<{ listName: string; count: number; ok: boolean; error?: string }> = [];

    for (const source of SOURCES) {
      const url = `${RAW_BASE}/${source.file}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          summary.push({ listName: source.listName, count: 0, ok: false, error: `HTTP ${res.status}` });
          continue;
        }
        const json = (await res.json()) as unknown;
        if (!Array.isArray(json)) {
          summary.push({ listName: source.listName, count: 0, ok: false, error: "non-array payload" });
          continue;
        }
        const entries = (json as RawEntry[])
          .map(normaliseEntry)
          .filter((e): e is { value: string; description: string; metadata?: unknown } => e !== null);

        await ctx.runMutation(internal.cds_codes.replaceList, {
          listName: source.listName,
          entries,
        });
        summary.push({ listName: source.listName, count: entries.length, ok: true });
      } catch (err) {
        summary.push({
          listName: source.listName,
          count: 0,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return summary;
  },
});
