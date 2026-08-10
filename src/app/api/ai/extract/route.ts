import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { AI_MAX_UPLOAD_BYTES, aiExtractLimiter } from "@/lib/api-rate-limiter";
import { assertLlmConfigured, createChatCompletion } from "@/lib/llm-chat";

async function extractTextWithTextract(buffer: Buffer): Promise<string> {
  const client = new TextractClient({
    region: process.env.AWS_REGION || "eu-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
  const response = await client.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: buffer },
    }),
  );
  if (!response.Blocks) return "";
  return response.Blocks.filter((b) => b.BlockType === "LINE")
    .map((b) => b.Text)
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!aiExtractLimiter.tryConsume(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No document file uploaded" }, { status: 400 });
    }
    if (file.size > AI_MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    try {
      assertLlmConfigured();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "LLM not configured" },
        { status: 500 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawText = "";
    try {
      rawText = await extractTextWithTextract(buffer);
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : "parse failed";
      console.error("AWS Textract Error:", parseError);
      return NextResponse.json(
        {
          error:
            "Failed to parse document via Textract. Upload a clear PNG/JPEG or a single-page PDF.",
          details: message,
        },
        { status: 400 },
      );
    }

    if (!rawText || rawText.trim() === "") {
      return NextResponse.json(
        { error: "No readable text found in the document via Textract" },
        { status: 400 },
      );
    }

    const { content: responseContent } = await createChatCompletion({
      json: true,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are an expert UK Customs Data Entry Assistant. I will provide raw, messy text extracted from a Commercial Invoice PDF. 
          Your job is to identify all the "line items" or commodities being shipped.
          Return a JSON object containing an "items" array. Each object in the array MUST contain:
          - "commodityCode": (string, 10-digit HS code only if clearly supported by the invoice text, otherwise empty string)
          - "description": (string, normal trade description for CDS DE 6/8 — plain language from the invoice line, precise enough to identify the goods; do NOT paste tariff book legal wording; include grade/purity/model if shown on invoice)
          - "originCountry": (string, 2-letter ISO country code of origin if stated on invoice, otherwise empty string — do NOT default to GB)
          - "valueAmount": (number, the total price/value for that line item)
          - "valueCurrency": (string, 3-letter currency code, e.g. "USD", "GBP", "EUR")
          - "procedureCode": (string, 4-digit CPC / requested procedure code if stated, otherwise empty string)
          - "additionalProcedureCode": (string, 3-digit additional procedure code if stated, otherwise empty string)
          - "grossWeightKg": (number, gross weight in kilograms if stated for the line item or shipment, otherwise null)
          - "netWeightKg": (number, net weight in kilograms if stated for the line item or shipment, otherwise null)
          - "supplementaryUnitQty": (number, number of items / pieces if stated, otherwise null)
          - "packageCount": (number, package/carton count if stated, otherwise null)
          - "packageType": (string, package type code such as "CT", "PK", or "BX" if stated, otherwise empty string)
          - "shippingMarks": (string, marks and numbers / shipping marks if stated, otherwise empty string)
          - "invoiceReference": (string, commercial invoice reference / invoice number if stated, otherwise empty string)
          - "packingListReference": (string, packing list reference if stated, otherwise empty string)
          Use exact values present in the invoice text. Do not invent missing customs values. If a single-item invoice gives shipment-level weights, packages, or marks, apply those values to that item.
          DO NOT include markdown code blocks.`,
        },
        {
          role: "user",
          content: `Here is the raw invoice text:\n\n${rawText}`,
        },
      ],
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent || "{}");
    } catch {
      return NextResponse.json({ error: "Failed to parse AI extraction response" }, { status: 500 });
    }

    const extractedItems = parsedResponse.items || [];
    return NextResponse.json({ items: extractedItems, rawText });
  } catch (error: unknown) {
    console.error("AI Extractor Error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
