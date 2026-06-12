import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export interface CollectedNotification {
  _id: string;
  mrn?: string | null;
  conversationId?: string | null;
  notificationType?: string | null;
  rawPayload?: string | null;
  fieldErrors?: Array<{ field: string; reason: string; code?: string }>;
  errorCodes?: string[];
  timestamp?: string | number;
  /** HMRC IssueDateTime (ISO) — authoritative order when present. */
  issueDateTime?: string | null;
}

/** HMRC IssueDateTime is authoritative; fall back to local receipt timestamp. */
function orderKey(n: CollectedNotification): number {
  const issue = new Date(String(n.issueDateTime ?? "")).getTime();
  if (Number.isFinite(issue)) return issue;
  return new Date(String(n.timestamp ?? 0)).getTime();
}

/** Same merge logic as notifications.getWebhooks — declaration + conversation + MRN. */
export async function collectDeclarationNotifications(
  db: QueryCtx["db"],
  args: {
    declarationId?: Id<"declarations">;
    conversationId?: string | null;
    mrn?: string | null;
  },
): Promise<CollectedNotification[]> {
  const seen = new Set<string>();
  const results: CollectedNotification[] = [];
  const conversationId = String(args.conversationId ?? "").trim();
  const mrn = String(args.mrn ?? "").trim();

  const push = (rows: CollectedNotification[]) => {
    for (const row of rows) {
      if (!seen.has(row._id)) {
        seen.add(row._id);
        results.push(row);
      }
    }
  };

  // When a submit conversationId exists, status/timeline authority is that cycle only.
  // MRN-indexed rows from earlier submits/amends on the same declaration must not replay.
  if (conversationId) {
    const convResults = await db
      .query("notifications")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
      .take(100);
    push(convResults as CollectedNotification[]);

    if (args.declarationId) {
      const declResults = await db
        .query("notifications")
        .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId!))
        .take(100);
      // Include same-MRN rows from other conversations (e.g. DMSACC on submit conv after
      // declaration.conversationId was overwritten by amend). Still exclude stale MRNs via scoped filter.
      push(
        (declResults as CollectedNotification[]).filter((n) => {
          const nConv = String(n.conversationId ?? "").trim();
          if (nConv === conversationId) return true;
          if (mrn && mrn !== "UNKNOWN") {
            const nMrn = String(n.mrn ?? "").trim();
            return nMrn === mrn || nMrn === "";
          }
          return false;
        }),
      );
    }
  } else {
    if (args.declarationId) {
      const declResults = await db
        .query("notifications")
        .withIndex("by_declaration", (q) => q.eq("declarationId", args.declarationId!))
        .take(100);
      push(declResults as CollectedNotification[]);
    }

    if (mrn && mrn !== "UNKNOWN") {
      const mrnResults = await db
        .query("notifications")
        .withIndex("by_mrn", (q) => q.eq("mrn", mrn))
        .take(100);
      push(mrnResults as CollectedNotification[]);
    }
  }

  // Catch rows linked only by MRN (e.g. submit-conversation pull before declarationId was patched).
  if (mrn && mrn !== "UNKNOWN") {
    const mrnResults = await db
      .query("notifications")
      .withIndex("by_mrn", (q) => q.eq("mrn", mrn))
      .take(100);
    push(mrnResults as CollectedNotification[]);
  }

  const scoped =
    mrn && mrn !== "UNKNOWN"
      ? results.filter((n) => String(n.mrn ?? "").trim() === mrn || !String(n.mrn ?? "").trim())
      : results;

  return scoped.sort((a, b) => orderKey(b) - orderKey(a));
}
