import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { parseHmrcNotification } from "../../../../../lib/hmrc-notification-parser";
import { buildHmrcNotificationIdempotencyKey } from "../../../../../lib/hmrc-notification-idempotency";
import { secretsEqual } from "../../../../../lib/secrets-equal";
import { userMessageFromError } from "@/lib/convex-errors";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const isProduction = process.env.NODE_ENV === "production";

/**
 * HEAD /api/hmrc/webhooks/notify
 * Tunnel/load-balancer probes (ngrok, Cloudflare) — not HMRC validation.
 */
export async function HEAD() {
  return new Response(null, { status: 200 });
}

/**
 * GET /api/hmrc/webhooks/notify?challenge=...
 * HMRC Developer Hub validates Push/Callback URLs with a challenge query param.
 * Must return 200 and JSON { "challenge": "<same value>" } within 20 seconds.
 * GET without ?challenge= returns 400 (browser/tunnel probes are not Hub validation).
 */
export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get("challenge");
  if (!challenge) {
    return NextResponse.json(
      {
        error: "Missing challenge query parameter",
        hint: "HMRC Hub validation uses GET ?challenge=<value> — echo it in JSON.",
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ challenge });
}

/**
 * POST /api/hmrc/webhooks/notify
 * HMRC Push Notification endpoint (Trade Test v2.0 sandbox + production).
 * HMRC POSTs DMS* notifications here once a submitted declaration changes state.
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const expectedToken = (
      process.env.HMRC_WEBHOOK_AUTH_TOKEN ||
      process.env.HMRC_CDS_CALLBACK_TOKEN ||
      process.env.HMRC_CDS_BEARER_TOKEN ||
      ""
    ).trim();
    const receivedToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const authMatches =
      expectedToken.length > 0 && receivedToken.length > 0 && secretsEqual(expectedToken, receivedToken);

    if (expectedToken.length === 0) {
      console.error("[HMRC-WEBHOOK] Missing webhook auth token configuration.");
      return NextResponse.json({ error: "Webhook auth token not configured" }, { status: 500 });
    }

    if (!authMatches) {
      console.warn("[HMRC-WEBHOOK] Unauthorized attempt.");
      return new Response("Unauthorized", { status: 401 });
    }

    const rawPayload = await request.text();
    const conversationId = request.headers.get("X-Conversation-ID") || "UNKNOWN";

    console.log(`[HMRC-WEBHOOK] Received authorized notification for Conversation ID: ${conversationId}`);
    if (!isProduction) {
      console.log(`[HMRC-WEBHOOK] Payload preview: ${rawPayload.substring(0, 500)}`);
    } else {
      console.log(`[HMRC-WEBHOOK] Payload length: ${rawPayload.length} bytes`);
    }

    const { notificationType, mrn, errorCodes, fieldErrors, issueDateTime, functionCode } = parseHmrcNotification(rawPayload);
    console.log(`[HMRC-WEBHOOK] Parsed: type=${notificationType}, mrn=${mrn}, errorCodes=${errorCodes.join(",") || "none"}`);
    const idempotencyKey = buildHmrcNotificationIdempotencyKey(rawPayload);

    const ingestSecret = process.env.NOTIFICATION_INGEST_SECRET?.trim();
    if (!ingestSecret) {
      console.error("[HMRC-WEBHOOK] NOTIFICATION_INGEST_SECRET not configured");
      return NextResponse.json({ error: "Notification ingest not configured" }, { status: 500 });
    }

    const webhookEnvironment =
      process.env.HMRC_ENVIRONMENT === "production" ? "production" : "sandbox";

    // Save to Convex for the dashboard to pick up
    await convex.mutation(api.notifications.saveWebhook, {
      ingestSecret,
      environment: webhookEnvironment,
      mrn,
      conversationId,
      notificationType,
      functionCode: functionCode || undefined,
      fieldErrors,
      errorCodes,
      rawPayload,
      idempotencyKey,
      issueDateTime,
      source: "push",
      timestamp: new Date().toISOString(),
    });

    // Auto-ingest curated rule proposals when HMRC rejects (FunctionCode 03 /
    // DMSREJ) and cites missing AdditionalDocument codes. Inserted rules are
    // ALWAYS disabled — the user reviews and promotes manually so a misread
    // rejection can never auto-block a future submission. Failures here are
    // non-critical: the raw payload is already persisted via saveWebhook.
    if (notificationType === "DMSREJ" && fieldErrors.length > 0) {
      try {
        const proposalResult = await convex.mutation(
          api.rule_definitions.proposeCuratedFromRejection,
          { ingestSecret, mrn, conversationId, fieldErrors },
        );
        console.log(`[HMRC-WEBHOOK] Curated rule proposals: ${JSON.stringify(proposalResult)}`);
      } catch (proposeErr) {
        console.warn("[HMRC-WEBHOOK] Curated proposal failed (non-critical):", proposeErr);
      }
    }

    // Provide the 200 OK that HMRC expects to acknowledge receipt
    return new Response(null, { status: 200 });
  } catch (error: unknown) {
    console.error("[HMRC-WEBHOOK] Crash:", error);
    const message = userMessageFromError(error, "Internal Server Error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
