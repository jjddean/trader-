import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    // Read the raw webhook body (usually XML from HMRC)
    const rawBody = await request.text();
    const headersList = request.headers;

    const conversationId = headersList.get("X-Conversation-ID");
    const mrn = headersList.get("X-MRN") || "UNKNOWN"; // HMRC sometimes passes MRN here or in body

    if (!conversationId) {
      console.error("HMRC Webhook dropped: Missing Conversation ID");
      return new NextResponse("Missing X-Conversation-ID header", { status: 400 });
    }

    // In a production environment, we would parse the XML WCO structure here
    // to determine the exact NotificationType (e.g., DMSCLE, DMSACC, DMSREJ)
    // For this boilerplate, we'll assign a mock status based on header or content
    let notificationType = "UNKNOWN";
    if (rawBody.includes("DMSCLE")) notificationType = "CLEARED";
    else if (rawBody.includes("DMSACC")) notificationType = "ACCEPTED";
    else if (rawBody.includes("DMSREJ")) notificationType = "REJECTED";

    // 1. Log the notification in Convex
    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      rawPayload: rawBody,
      timestamp: new Date().toISOString()
    });

    // 2. Acknowledge Receipt to HMRC
    return new NextResponse("Acknowledged", { status: 202 });

  } catch (error: any) {
    console.error("Critical Webhook Failure:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
