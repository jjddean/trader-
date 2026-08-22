import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";
import { userMessageFromError } from "@/lib/convex-errors";
import { collectNotifications, collectOutcomes } from "../../../../../lib/ens/ens-collector";
import { resolveOrgHmrcRoutingForOrg } from "../../../../../lib/hmrc-org-routing";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";

/**
 * POST /api/hmrc/ens/collect
 *
 * Drains both S&S pull queues: outcomes and advanced notifications.
 *
 * Spec: `docs/hmrc/ens/IMPLEMENTATION_SPEC.md` §5–6
 *
 * ENS has no webhook — unlike the CDS path, which receives pushes at
 * `/api/hmrc/webhooks/notify` with a pull fallback. Both queues must be drained
 * or items accumulate silently at HMRC.
 *
 * The sequence is list → retrieve → **persist** → acknowledge, enforced by
 * `ens-collector`. Persistence runs through Convex here and is awaited before
 * HMRC's DELETE, because that DELETE cannot be undone: an acknowledged item is
 * gone from HMRC with no way to re-fetch it.
 *
 * A Do Not Load is stored but deliberately **not** acknowledged, so it stays on
 * HMRC's list until a human clears it.
 */
export async function POST() {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) return session.error;
    const { convex, userId } = session;

    const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, clerkAuth.orgId);
    if ("error" in orgRouting) return orgRouting.error;
    const { hmrcContext } = orgRouting;

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) return tokenResult.error;

    const environment = (hmrcContext.environment ?? "sandbox") as "sandbox" | "production";
    const opts = { environment, accessToken: tokenResult.token };

    const outcomeReport = await collectOutcomes(opts, async (outcome, entry, rawXml) => {
      const outcomeId = await convex.mutation(api.ens_outcomes.recordOutcome, {
        correlationId: entry.correlationId,
        outcomeType: outcome.outcomeType,
        movementReferenceNumber: outcome.movementReferenceNumber,
        errors: outcome.errors.length > 0 ? outcome.errors : undefined,
        rawXml,
      });
      // Stamped here rather than after the DELETE returns: the row exists and
      // is the evidence. If the DELETE then fails, HMRC re-lists the item and
      // recordOutcome is idempotent on correlationId + outcomeType.
      await convex.mutation(api.ens_outcomes.markOutcomeAcknowledged, {
        id: outcomeId as Id<"ens_outcomes">,
      });
    });

    const notificationReport = await collectNotifications(opts, async (notification, entry, rawXml) => {
      await convex.mutation(api.ens_outcomes.recordNotification, {
        notificationId: entry.notificationId,
        correlationId: notification.correlationIdentifier ?? entry.correlationId,
        movementReferenceNumber: notification.movementReferenceNumber,
        interventions: notification.interventions,
        doNotLoad: notification.doNotLoad,
        rawXml,
      });
    });

    const doNotLoadCount = notificationReport.items.filter(
      (i) => i.notification?.doNotLoad,
    ).length;

    return NextResponse.json({
      outcomes: {
        collected: outcomeReport.items.length,
        acknowledged: outcomeReport.items.filter((i) => i.acknowledged).length,
        skipped: outcomeReport.skipped,
        transportError: outcomeReport.transportError,
      },
      notifications: {
        collected: notificationReport.items.length,
        acknowledged: notificationReport.items.filter((i) => i.acknowledged).length,
        skipped: notificationReport.skipped,
        transportError: notificationReport.transportError,
      },
      doNotLoadCount,
      ...(doNotLoadCount > 0
        ? {
            warning: `${doNotLoadCount} Do Not Load notification(s) received. The goods must not be loaded. These remain unacknowledged at HMRC until cleared by an operator.`,
          }
        : {}),
    });
  } catch (error) {
    console.error("[ENS COLLECT] failed", error);
    return NextResponse.json({ error: userMessageFromError(error) }, { status: 500 });
  }
}
