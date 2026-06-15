import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/** Non-fatal HMRC lifecycle audit — failures must not crash the main operation. */
export async function logHmrcAudit(
  convex: ConvexHttpClient,
  _userId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await convex.mutation(api.audit.logMyAction, { action, metadata });
  } catch (err) {
    console.warn(`[AUDIT] Failed to log ${action} (non-critical):`, err);
  }
}
