import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Liveness probe for /api/health.
 *
 * Deliberately unauthenticated and deliberately trivial: it proves the
 * deployment is reachable and executing functions, nothing more. It reads no
 * user data, so it leaks nothing and cannot be used to enumerate anything.
 *
 * It does perform one system read so a deployment that is up but whose
 * database is not responding fails rather than returning ok.
 */
export const ping = query({
  args: {},
  returns: v.object({ ok: v.boolean(), at: v.number() }),
  handler: async (ctx) => {
    // Cheapest possible round-trip to storage; result deliberately unused.
    await ctx.db.system.query("_storage").take(1);
    return { ok: true, at: Date.now() };
  },
});
