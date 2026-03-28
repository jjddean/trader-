import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * POST /api/hmrc/webhooks/notify
 * HMRC Push Notification endpoint (TDR/Production)
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization") || "";
    const expectedToken = process.env.HMRC_CDS_BEARER_TOKEN || "";
    
    // HMRC may send raw token or "Bearer {token}" format
    const receivedToken = authHeader.replace(/^Bearer\s+/i, "");
    
    if (!expectedToken || receivedToken !== expectedToken) {
      console.warn(`[HMRC-WEBHOOK] Unauthorized attempt. Received: ${authHeader?.substring(0, 12)}...`);
      return new Response("Unauthorized", { status: 401 });
    }

    const rawPayload = await request.text();
    const conversationId = request.headers.get("X-Conversation-ID") || "UNKNOWN";
    
    console.log(`[HMRC-WEBHOOK] Received authorized notification for Conversation ID: ${conversationId}`);

    // Basic logic to determine notification type from XML
    let notificationType = "UNKNOWN";
    const upperBody = rawPayload.toUpperCase();
    if (upperBody.includes("DMSCLE")) notificationType = "DMSCLE";
    else if (upperBody.includes("DMSACC")) notificationType = "DMSACC";
    else if (upperBody.includes("DMSREJ")) notificationType = "DMSREJ";
    else if (upperBody.includes("DMSROG")) notificationType = "DMSROG";
    else if (upperBody.includes("DMSINV")) notificationType = "DMSINV";
    else if (upperBody.includes("DMSTAX")) notificationType = "DMSTAX";
    else if (upperBody.includes("DMSCTL")) notificationType = "DMSCTL";
    else if (upperBody.includes("DMSRES")) notificationType = "DMSRES";

    let mrn = "UNKNOWN";
    const mrnMatch = rawPayload.match(/<(?:[^>]*:)?ID[^>]*>([0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14})<\/(?:[^>]*:)?ID>/i);
    if (mrnMatch?.[1]) mrn = mrnMatch[1];

    // Save to Convex for the dashboard to pick up
    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      fieldErrors: [],
      errorCodes: [],
      rawPayload,
      timestamp: new Date().toISOString(),
    });

    // Provide the 200 OK that HMRC expects to acknowledge receipt
    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error("[HMRC-WEBHOOK] Crash:", error);
    // Return 500 so HMRC retries
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
