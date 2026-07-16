import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

export function confirmPracticeFlip(displayLabel: string): boolean {
  return window.confirm(
    `Switch ${displayLabel} to practice (sandbox)? Submissions will go to HMRC test environment only.`,
  );
}

export function confirmLiveFlip(displayLabel: string): boolean {
  return window.confirm(
    `Enable live CDS for ${displayLabel}? Submissions will have legal effect at the border.`,
  );
}

/** Pre-flight for admin → Live. Convex env is the source of truth (same as setOrgMode). */
export async function collectLiveFlipBlockers(
  convex: ConvexReactClient,
  orgId: string,
): Promise<string[]> {
  const readiness = await convex.query(api.org_hmrc.getLiveReadinessForOrg, { orgId });
  return readiness.blockers;
}
