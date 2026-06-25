import type { QueryCtx, MutationCtx } from "../_generated/server";

export interface OrgLiveReadiness {
  orgId: string;
  canProceed: boolean;
  blockers: string[];
}

type ReadinessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function evaluateOrgLiveReadiness(
  ctx: ReadinessCtx,
  orgId: string,
): Promise<OrgLiveReadiness> {
  const trimmedOrgId = orgId.trim();

  const [users, tokens] = await Promise.all([
    ctx.db.query("users").take(500),
    ctx.db.query("hmrc_tokens").take(500),
  ]);

  const orgClerkIds = new Set(
    users
      .filter(
        (user) => typeof user.orgId === "string" && user.orgId.trim() === trimmedOrgId,
      )
      .map((user) => (typeof user.clerkId === "string" ? user.clerkId.trim() : ""))
      .filter(Boolean),
  );

  const now = Date.now();
  const activeConnections = tokens.filter((token) => {
    const userId = typeof token.userId === "string" ? token.userId.trim() : "";
    return orgClerkIds.has(userId) && Number(token.expiresAt ?? 0) > now;
  });

  const blockers =
    activeConnections.length > 0
      ? []
      : ["No org member has a valid HMRC connection — connect in Settings first."];

  return {
    orgId: trimmedOrgId,
    canProceed: blockers.length === 0,
    blockers,
  };
}
