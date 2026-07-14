import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

export function confirmPracticeFlip(displayLabel: string): boolean {
  return window.confirm(
    `Switch ${displayLabel} to the test environment (sandbox)? Submissions will go to HMRC test environment only.`,
  );
}

export function confirmLiveFlip(displayLabel: string): boolean {
  return window.confirm(
    `Enable live CDS for ${displayLabel}? Submissions will have legal effect at the border.`,
  );
}

export async function collectLiveFlipBlockers(
  convex: ConvexReactClient,
  orgId: string,
): Promise<string[]> {
  const blockers: string[] = [];

  try {
    const health = await fetch("/api/health").then((res) => res.json());
    if (!health?.livePlatform?.productionHmrcOAuth) {
      blockers.push("Production HMRC OAuth is not configured in Vercel.");
    }
  } catch {
    blockers.push("Could not verify platform HMRC configuration.");
  }

  const readiness = await convex.query(api.org_hmrc.getLiveReadinessForOrg, { orgId });
  blockers.push(...readiness.blockers);

  return blockers;
}
