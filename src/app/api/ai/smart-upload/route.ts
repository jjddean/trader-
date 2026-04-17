import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { auth } from "@clerk/nextjs/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId, getToken } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const convexToken = await getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Missing Convex auth token" }, { status: 401 });
    }
    convex.setAuth(convexToken);
    const logSmartUploadError = async (code: string, message: string, metadata?: Record<string, any>) => {
      try {
        await convex.mutation(api.audit.logAction, {
          action: "smart_upload_error",
          userId: clerkUserId,
          metadata: {
            route: "/api/ai/smart-upload",
            code,
            message,
            ...metadata,
          },
        });
      } catch {
        // Ignore telemetry errors.
      }
    };

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const pasteText = formData.get("pasteText") as string | null;
    const type = formData.get("type") as string;
    const linkedDeclarationId = formData.get("linkedDeclarationId") as string | null;
    const linkedMrn = formData.get("linkedMrn") as string;
    const replaceDocumentId = formData.get("replaceDocumentId") as string | null;
    const userId = formData.get("userId") as string;
    if (userId && userId !== clerkUserId) {
      await logSmartUploadError("USER_MISMATCH", "Request userId does not match authenticated Clerk user.", {
        providedUserId: userId,
      });
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    if (!file && !pasteText) {
      await logSmartUploadError("MISSING_INPUT", "No file or paste text provided.");
      return NextResponse.json({ error: "No document file or pasted text provided" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      await logSmartUploadError("MISSING_GROQ_KEY", "GROQ_API_KEY not configured.");
      return NextResponse.json({ error: "Cloudagent endpoint (Groq) is not reachable or configured." }, { status: 500 });
    }

    let rawText = "";
    let buffer: Buffer = Buffer.from([]);
    let fileName: string = "";
    let mimeType: string = "";

    if (pasteText) {
      // Bypass Textract and use the pasted text directly
      rawText = pasteText;
      buffer = Buffer.from(pasteText, 'utf-8');
      const safeTypeToken = String(type || "document")
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48);
      fileName = `pasted_${safeTypeToken || "document"}_${Date.now()}.txt`;
      mimeType = "text/plain";
    } else if (file) {
      if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return NextResponse.json({ error: "AWS Textract is not configured on this environment." }, { status: 500 });
      }

      // 1. AWS Textract
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      fileName = file.name;
      mimeType = file.type;
      
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
        await logSmartUploadError("TEXTRACT_PARSE_FAILED", "AWS Textract parse failed.", {
          details: String(parseError?.message || "unknown"),
        });
        return NextResponse.json({ error: "Failed to parse document using Textract.", details: parseError.message }, { status: 400 });
      }
    }

    if (!rawText || rawText.trim() === "") {
      await logSmartUploadError("EMPTY_OCR_TEXT", "No readable text found after OCR/paste extraction.");
      return NextResponse.json({ error: "No readable text found" }, { status: 400 });
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
      await logSmartUploadError("AI_JSON_INVALID", "Classifier response was not valid JSON.");
      return NextResponse.json({ error: "Cloudagent AI classifier failed to return valid JSON" }, { status: 500 });
    }

    // 3. Save to Convex
    // Upload actual file to Convex storage to get storageId
    const postUrl = await convex.mutation(api.documents.generateUploadUrl);
    
    const storageRes = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: new Uint8Array(buffer),
    });
    
    if (!storageRes.ok) {
       await logSmartUploadError("STORAGE_UPLOAD_FAILED", "Failed to upload file payload to Convex storage.", {
         status: storageRes.status,
       });
       return NextResponse.json({ error: "Failed to save file to Convex storage" }, { status: 500 });
    }
    const { storageId } = await storageRes.json();

    const classifiedType = String(parsedResponse.documentType || "").trim();
    const hasGenericAiType = /^(other|unknown|misc|n\/a)$/i.test(classifiedType);
    const resolvedFileType = !hasGenericAiType && classifiedType
      ? classifiedType
      : (String(type || "").trim() || classifiedType || "Unknown");

    const savePayload = {
      storageId,
      userId: clerkUserId,
      fileName: fileName,
      mrn: linkedMrn && linkedMrn !== "none" && linkedMrn !== "Unlinked" ? linkedMrn : undefined,
      declarationId: linkedDeclarationId && linkedDeclarationId !== "none" ? (linkedDeclarationId as any) : undefined,
      auditStatus: String(parsedResponse.status || "pending").toLowerCase(),
      fileType: resolvedFileType,
      ocrText: rawText,
    };

    const newDocId = replaceDocumentId
      ? await convex.mutation(api.documents.replaceDocument, {
          documentId: replaceDocumentId as any,
          ...savePayload,
        })
      : await convex.mutation(api.documents.saveDocument, savePayload);

    return NextResponse.json({ success: true, documentId: (newDocId as any)?.documentId || newDocId, analysis: parsedResponse, ocrText: rawText });

  } catch (error: any) {
    console.error("Smart Upload AI Error:", error);
    try {
      const { userId: fallbackUserId, getToken } = await auth();
      if (fallbackUserId) {
        const fallbackToken = await getToken({ template: "convex" });
        if (fallbackToken) {
          convex.setAuth(fallbackToken);
          await convex.mutation(api.audit.logAction, {
            action: "smart_upload_error",
            userId: fallbackUserId,
            metadata: {
              route: "/api/ai/smart-upload",
              code: "UNHANDLED_EXCEPTION",
              message: String(error?.message || "Unhandled error"),
            },
          });
        }
      }
    } catch {
      // no-op
    }
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
