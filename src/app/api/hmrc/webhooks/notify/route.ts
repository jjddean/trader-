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
    console.log(`[HMRC-WEBHOOK] Payload preview: ${rawPayload.substring(0, 500)}`);

    // Extract notification type from HMRC XML
    // HMRC uses <FunctionCode>, <NameCode>, or the literal DMS codes
    let notificationType = "UNKNOWN";
    const upperBody = rawPayload.toUpperCase();
    
    // Method 1: Check for literal DMS notification type codes
    const dmsTypes = ["DMSCLE", "DMSACC", "DMSREJ", "DMSROG", "DMSINV", "DMSTAX", "DMSCTL", "DMSRES", "DMSRCV", "DMSREQ", "DMSQRY", "DMSDOC", "DMSNOTFN", "DMSSUB"];
    for (const t of dmsTypes) {
      if (upperBody.includes(t)) {
        notificationType = t;
        break;
      }
    }
    
    // Method 2: Check <NameCode> element (HMRC wraps type here sometimes)
    if (notificationType === "UNKNOWN") {
      const nameCodeMatch = rawPayload.match(/<(?:[^>]*:)?NameCode[^>]*>([^<]+)<\/(?:[^>]*:)?NameCode>/i);
      if (nameCodeMatch?.[1]) notificationType = nameCodeMatch[1].trim().toUpperCase();
    }
    
    // Method 3: Check <FunctionCode> — maps numeric codes to types
    if (notificationType === "UNKNOWN") {
      const funcCodeMatch = rawPayload.match(/<(?:[^>]*:)?FunctionCode[^>]*>(\d+)<\/(?:[^>]*:)?FunctionCode>/i);
      if (funcCodeMatch?.[1]) {
        const funcCode = funcCodeMatch[1];
        const funcMap: Record<string, string> = { "01": "DMSACC", "03": "DMSREJ", "05": "DMSROG", "09": "DMSACC", "11": "DMSCLE", "13": "DMSREJ", "02": "DMSINV" };
        notificationType = funcMap[funcCode] || `FUNC_${funcCode}`;
      }
    }

    // Extract MRN - try multiple patterns
    let mrn = "UNKNOWN";
    // Pattern 1: Standard 18-char MRN format (e.g. 26GB3G1TKA3Z7KXA02)
    const mrnMatch = rawPayload.match(/\b(\d{2}[A-Z]{2}[A-Z0-9]{14})\b/);
    if (mrnMatch?.[1]) mrn = mrnMatch[1];
    // Pattern 2: Inside <ID> tags
    if (mrn === "UNKNOWN") {
      const idMatch = rawPayload.match(/<(?:[^>]*:)?ID[^>]*>([0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14})<\/(?:[^>]*:)?ID>/i);
      if (idMatch?.[1]) mrn = idMatch[1];
    }
    
    console.log(`[HMRC-WEBHOOK] Parsed: type=${notificationType}, mrn=${mrn}`);

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
