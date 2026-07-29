import type { QueryCtx, MutationCtx } from "../_generated/server";

export interface OrgLiveReadiness {
  orgId: string;
  canProceed: boolean;
  blockers: string[];
}

type ReadinessCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

/**
 * Deployment-level guard that mirrors src/lib/hmrc-context.ts
 * assertOrgHmrcRoutingAllowed: an org cannot be served Live while this
 * deployment is sandbox-only, and production OAuth credentials must exist.
 *
 * Production HMRC OAuth for org members happens *after* the flip — Settings
 * Connect uses production only when hmrcMode is live.
 */
function deploymentLiveBlockers(): string[] {
  const blockers: string[] = [];

  const deploymentSandbox = process.env.HMRC_ENVIRONMENT === "sandbox";
  if (deploymentSandbox && !process.env.HMRC_ALLOW_LIVE_ON_SANDBOX_DEPLOY) {
    blockers.push(
      "This deployment is sandbox-only (HMRC_ENVIRONMENT=sandbox) — Live submissions would be blocked with 403.",
    );
  }

  const hasProductionCreds =
    Boolean(process.env.HMRC_PRODUCTION_CLIENT_ID?.trim()) &&
    Boolean(process.env.HMRC_PRODUCTION_CLIENT_SECRET?.trim());
  if (!hasProductionCreds) {
    blockers.push(
      "Production HMRC OAuth credentials are not configured (HMRC_PRODUCTION_CLIENT_ID/SECRET).",
    );
  }

  return blockers;
}

export async function evaluateOrgLiveReadiness(
  _ctx: ReadinessCtx,
  orgId: string,
): Promise<OrgLiveReadiness> {
  const blockers = deploymentLiveBlockers();
  return {
    orgId: orgId.trim(),
    canProceed: blockers.length === 0,
    blockers,
  };
}
