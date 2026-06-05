import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

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
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No document file uploaded" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: "Groq API Key not configured" }, { status: 500 });
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
      return NextResponse.json({ error: "No readable text found in the document via Textract" }, { status: 400 });
    }

    const groq = new Groq({ apiKey: groqApiKey });
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert UK Customs Data Entry Assistant. I will provide raw, messy text extracted from a Commercial Invoice PDF. 
          Your job is to identify all the "line items" or commodities being shipped.
          Return a JSON object containing an "items" array. Each object in the array MUST contain:
          - "commodityCode": (string, try to guess the 10 digit HS code based on description, or leave empty if unknown)
          - "description": (string, the product name)
          - "originCountry": (string, the 2-letter ISO country code of origin, try to infer from the invoice header, default to "GB")
          - "valueAmount": (number, the total price/value for that line item)
          - "valueCurrency": (string, 3-letter currency code, e.g. "USD", "GBP", "EUR")
          DO NOT include markdown code blocks.`,
        },
        {
          role: "user",
          content: `Here is the raw invoice text:\n\n${rawText}`,
        },
      ],
      model: model,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
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
