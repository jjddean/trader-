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
      push(
        (declResults as CollectedNotification[]).filter(
          (n) => String(n.conversationId ?? "").trim() === conversationId,
        ),
      );
    }
    // Also include MRN-only notifications when we have a conversationId.
    // Some HMRC notifications (e.g., DMSCLE) may arrive with only an MRN
    // and no conversationId; excluding them loses timeline entries. We
    // therefore fetch by_mrn and include rows that do NOT have a
    // conversationId (MRN-only), avoiding replay of older conversation-scoped rows.
    if (mrn && mrn !== "UNKNOWN") {
      const mrnResults = await db
        .query("notifications")
        .withIndex("by_mrn", (q) => q.eq("mrn", mrn))
        .take(100);
      push(
        (mrnResults as CollectedNotification[]).filter(
          (n) => !String(n.conversationId ?? "").trim(),
        ),
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

  const scoped = (args.declarationId || conversationId)
    ? results
    : mrn && mrn !== "UNKNOWN"
    ? results.filter((n) => String(n.mrn ?? "").trim() === mrn || !String(n.mrn ?? "").trim())
    : results;

  return scoped.sort(
    (a, b) =>
      new Date(String(b.timestamp ?? 0)).getTime() - new Date(String(a.timestamp ?? 0)).getTime(),
  );
}
