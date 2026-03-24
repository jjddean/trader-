import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;
    const linkedMrn = formData.get("linkedMrn") as string;
    const userId = formData.get("userId") as string;

    if (!file) {
      return NextResponse.json({ error: "No document file uploaded" }, { status: 400 });
    }

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return NextResponse.json({ error: "AWS Textract is not configured on this environment." }, { status: 500 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: "Cloudagent endpoint (Groq) is not reachable or configured." }, { status: 500 });
    }

    // 1. AWS Textract
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let rawText = "";
    try {
      const client = new TextractClient({
        region: process.env.AWS_REGION || "eu-west-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      });
      const command = new DetectDocumentTextCommand({ Document: { Bytes: buffer } });
      const response = await client.send(command);
      if (response.Blocks) {
        rawText = response.Blocks.filter(b => b.BlockType === "LINE").map(b => b.Text).join("\n");
      }
    } catch (parseError: any) {
      console.error("AWS Textract Error:", parseError);
      return NextResponse.json({ error: "Failed to parse PDF document using Textract.", details: parseError.message }, { status: 400 });
    }

    if (!rawText || rawText.trim() === "") {
      return NextResponse.json({ error: "No readable text found via Textract" }, { status: 400 });
    }

    // 2. Cloudagent AI Classifier
    const groq = new Groq({ apiKey: groqApiKey });
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a Document Classification Agent. Analyze the OCR text of this customs document.
          Return a JSON object:
          {
            "documentType": "string (e.g., Commercial Invoice, Packing List)",
            "complianceFlags": ["string array of missing fields or suspicious details"],
            "extractedFields": { "value": "numeric", "origin": "string code", "dates": ["string"] },
            "status": "string (Verified / Review / Missing)"
          }`
        },
        { role: "user", content: `OCR Text:\n\n${rawText}` }
      ],
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch {
      return NextResponse.json({ error: "Cloudagent AI classifier failed to return valid JSON" }, { status: 500 });
    }

    // 3. Save to Convex
    // Upload actual file to Convex storage to get storageId
    const postUrl = await convex.mutation(api.documents.generateUploadUrl);
    const storageRes = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: buffer,
    });
    
    if (!storageRes.ok) {
       return NextResponse.json({ error: "Failed to save file to Convex storage" }, { status: 500 });
    }
    const { storageId } = await storageRes.json();

    const newDocId = await convex.mutation(api.documents.saveDocument, {
      storageId,
      userId: userId || "system",
      fileName: file.name,
      mrn: linkedMrn !== "none" ? linkedMrn : undefined,
      auditStatus: parsedResponse.status.toLowerCase(),
      fileType: parsedResponse.documentType,
    });

    return NextResponse.json({ success: true, documentId: newDocId, analysis: parsedResponse });

  } catch (error: any) {
    console.error("Smart Upload AI Error:", error);
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
