import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    console.log("=========================================");
    console.log("🚨 HMRC ASYNC WEBHOOK NOTIFICATION RECEIVED 🚨");
    console.log("=========================================");
    
    // Parse HMRC Push Notification Envelope (usually JSON wrapping the XML details)
    let payloadStr = rawBody;
    let notificationType = "UPDATE";
    
    try {
      const jsonBody = JSON.parse(rawBody);
      console.log("Parsed HMRC JSON Envelope:", Object.keys(jsonBody));
      // HMRC Push Notifications usually contain eventType and the raw message
      if (jsonBody.eventType) notificationType = jsonBody.eventType;
      
      // If the actual WCO XML is nested inside a property (like 'message' or 'notification')
      payloadStr = jsonBody.message || jsonBody.notification || rawBody;
    } catch {
      // Fallback if HMRC sends raw XML directly
      console.log("HMRC payload is raw XML, skipping JSON parse.");
    }
    
    const conversationId = request.headers.get("x-conversation-id") || "UNKNOWN";
    
    // Fallback status deduction from WCO XML traits if the JSON eventType isn't clear
    if (notificationType === "UPDATE") {
      if (payloadStr.includes("cvc-") || payloadStr.includes("Rejected") || payloadStr.includes("Errors")) {
        notificationType = "REJECTED";
      } else if (payloadStr.includes("Cleared") || payloadStr.includes("01")) {
        notificationType = "CLEARED";
      } else if (payloadStr.includes("Accepted") || payloadStr.includes("02")) {
        notificationType = "ACCEPTED";
      }
    }

    let mrn = "UNKNOWN";
    const mrnMatch = payloadStr.match(/<(?:.*?:)?MRN>(.*?)<\/(?:.*?:)?MRN>/);
    if (mrnMatch && mrnMatch[1]) {
      mrn = mrnMatch[1];
    }

    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      rawPayload: payloadStr,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ success: true, message: "Webhook acknowledged" }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook Failure" }, { status: 500 });
  }
}
