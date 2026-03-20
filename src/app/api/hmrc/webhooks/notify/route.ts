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
      } else if (payloadStr.includes("Goods Arrived") || payloadStr.includes("06")) {
        notificationType = "GOODS_ARRIVED";
      } else if (payloadStr.includes("Held") || payloadStr.includes("Under Control") || payloadStr.includes("03")) {
        notificationType = "HELD";
      } else if (payloadStr.includes("Documents Required") || payloadStr.includes("AdditionalDocument") || payloadStr.includes("04") || payloadStr.includes("21")) {
        notificationType = "DOCUMENTS_REQUIRED";
      }
    }

    let mrn = "UNKNOWN";
    
    // CDS WCO XML returns the MRN in <Declaration><ID>24GB...
    // Or sometimes explicitly as <MovementReferenceNumber> depending on the notification type
    const idMatch = payloadStr.match(/<(?:[^>]*:)?ID[^>]*>([0-9]{2}[A-Za-z]{2}[A-Za-z0-9]{14})<\/(?:[^>]*:)?ID>/i);
    const mrnTagMatch = payloadStr.match(/<(?:[^>]*:)?MRN[^>]*>([a-zA-Z0-9]{18})<\/(?:[^>]*:)?MRN>/i);
    const mRNMatch = payloadStr.match(/<(?:[^>]*:)?MovementReferenceNumber[^>]*>([a-zA-Z0-9]{18})<\/(?:[^>]*:)?MovementReferenceNumber>/i);

    if (idMatch && idMatch[1]) {
      mrn = idMatch[1];
    } else if (mrnTagMatch && mrnTagMatch[1]) {
      mrn = mrnTagMatch[1];
    } else if (mRNMatch && mRNMatch[1]) {
      mrn = mRNMatch[1];
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
