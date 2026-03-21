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

    let payloadStr = rawBody;
    let notificationType = "DMSUB";
    let parsedJsonBody: any = null;

    try {
      const jsonBody = JSON.parse(rawBody);
      parsedJsonBody = jsonBody;
      console.log("Parsed HMRC JSON Envelope:", Object.keys(jsonBody));
      const candidateType = String(
        jsonBody.notificationType ||
          jsonBody.eventType ||
          jsonBody.messageType ||
          jsonBody.type ||
          "",
      ).toUpperCase();
      if (candidateType) {
        if (candidateType.includes("DMSCLE") || candidateType.includes("CLEARED")) notificationType = "DMSCLE";
        else if (candidateType.includes("DMSACC") || candidateType.includes("ACCEPTED")) notificationType = "DMSACC";
        else if (candidateType.includes("DMSREJ") || candidateType.includes("REJECTED")) notificationType = "DMSREJ";
        else if (candidateType.includes("DMSROG") || candidateType.includes("ROUTE")) notificationType = "DMSROG";
        else if (candidateType.includes("DMSINV") || candidateType.includes("INVALID")) notificationType = "DMSINV";
        else if (candidateType.includes("DMSUB") || candidateType.includes("SUBMITTED") || candidateType.includes("RECEIVED")) notificationType = "DMSUB";
      }

      payloadStr = jsonBody.message || jsonBody.notification || rawBody;
    } catch {
      console.log("HMRC payload is raw XML, skipping JSON parse.");
    }

    const conversationId = request.headers.get("x-conversation-id") || "UNKNOWN";

    if (notificationType === "DMSUB") {
      const upperPayload = payloadStr.toUpperCase();
      if (upperPayload.includes("DMSCLE") || upperPayload.includes("CLEARED")) notificationType = "DMSCLE";
      else if (upperPayload.includes("DMSACC") || upperPayload.includes("ACCEPTED")) notificationType = "DMSACC";
      else if (upperPayload.includes("DMSREJ") || upperPayload.includes("REJECTED")) notificationType = "DMSREJ";
      else if (upperPayload.includes("DMSROG") || upperPayload.includes("ROUTE TO EXAMINE")) notificationType = "DMSROG";
      else if (upperPayload.includes("DMSINV") || upperPayload.includes("INVALID")) notificationType = "DMSINV";
      else if (upperPayload.includes("DMSUB") || upperPayload.includes("SUBMITTED") || upperPayload.includes("RECEIVED")) notificationType = "DMSUB";
    }

    let mrn = "UNKNOWN";

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

    const fieldErrors = extractFieldErrors(notificationType, payloadStr, parsedJsonBody);
    const errorCodes = Array.from(new Set(fieldErrors.map((e) => e.code).filter(Boolean) as string[]));

    await convex.mutation(api.notifications.saveWebhook, {
      mrn,
      conversationId,
      notificationType,
      fieldErrors,
      errorCodes,
      rawPayload: payloadStr,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ success: true, message: "Webhook acknowledged" }, { status: 200 });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook Failure" }, { status: 500 });
  }
}

function extractFieldErrors(
  notificationType: string,
  payloadStr: string,
  parsedJsonBody: any,
): Array<{ field: string; code?: string; reason: string }> {
  if (notificationType !== "DMSINV" && notificationType !== "DMSREJ") {
    return [];
  }

  const errors: Array<{ field: string; code?: string; reason: string }> = [];

  if (parsedJsonBody?.errors && Array.isArray(parsedJsonBody.errors)) {
    for (const err of parsedJsonBody.errors) {
      errors.push({
        field: String(err.field || err.path || "unknown"),
        code: err.code ? String(err.code) : undefined,
        reason: String(err.message || err.reason || "Validation error"),
      });
    }
  }

  const xmlErrorRegex = /<(?:[^>]*:)?Error[^>]*>([\s\S]*?)<\/(?:[^>]*:)?Error>/gi;
  let xmlMatch: RegExpExecArray | null;
  while ((xmlMatch = xmlErrorRegex.exec(payloadStr)) !== null) {
    const block = xmlMatch[1];
    const code = block.match(/<(?:[^>]*:)?(?:Code|ErrorCode)[^>]*>(.*?)<\/(?:[^>]*:)?(?:Code|ErrorCode)>/i)?.[1]?.trim();
    const field = block.match(/<(?:[^>]*:)?(?:Field|FieldName|Pointer|Element)[^>]*>(.*?)<\/(?:[^>]*:)?(?:Field|FieldName|Pointer|Element)>/i)?.[1]?.trim() || "unknown";
    const reason = block.match(/<(?:[^>]*:)?(?:Message|Reason|Description)[^>]*>(.*?)<\/(?:[^>]*:)?(?:Message|Reason|Description)>/i)?.[1]?.trim() || "Validation error";
    errors.push({ field, code, reason });
  }

  const cvcRegex = /(cvc-[a-z0-9.-]+)[^<\n\r]*/gi;
  let cvcMatch: RegExpExecArray | null;
  while ((cvcMatch = cvcRegex.exec(payloadStr)) !== null) {
    errors.push({
      field: "xmlSchema",
      code: cvcMatch[1],
      reason: cvcMatch[0],
    });
  }

  return errors.filter((err, index, arr) => {
    const key = `${err.field}|${err.code || ""}|${err.reason}`;
    return arr.findIndex((x) => `${x.field}|${x.code || ""}|${x.reason}` === key) === index;
  });
}
