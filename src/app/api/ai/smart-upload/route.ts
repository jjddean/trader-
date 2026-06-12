import { NextResponse } from "next/server";
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { cloudagentConfigured, postCloudagent } from "@/lib/cloudagent-client";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface DocumentClassification {
  documentType?: string;
  complianceFlags?: string[];
  extractedFields?: Record<string, unknown>;
  status?: string;
  error?: string;
}

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
    const logSmartUploadError = async (code: string, message: string, metadata?: Record<string, unknown>) => {
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

    if (!cloudagentConfigured()) {
      await logSmartUploadError("MISSING_AGENT_URL", "AGENT_URL not configured.");
      return NextResponse.json(
        { error: "Cloudflare Cloudagent (AGENT_URL) is not configured." },
        { status: 500 },
      );
    }

    let rawText = "";
    let buffer: Buffer = Buffer.from([]);
    let fileName = "";
    let mimeType = "";

    if (pasteText) {
      rawText = pasteText;
      buffer = Buffer.from(pasteText, "utf-8");
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
          },
        });
        const command = new DetectDocumentTextCommand({ Document: { Bytes: buffer } });
        const response = await client.send(command);
        if (response.Blocks) {
          rawText = response.Blocks.filter((b) => b.BlockType === "LINE")
            .map((b) => b.Text)
            .join("\n");
        }
      } catch (parseError: unknown) {
        const message = parseError instanceof Error ? parseError.message : "unknown";
        console.error("AWS Textract Error:", parseError);
        await logSmartUploadError("TEXTRACT_PARSE_FAILED", "AWS Textract parse failed.", { details: message });
        return NextResponse.json({ error: "Failed to parse document using Textract.", details: message }, { status: 400 });
      }
    }

    if (!rawText || rawText.trim() === "") {
      await logSmartUploadError("EMPTY_OCR_TEXT", "No readable text found after OCR/paste extraction.");
      return NextResponse.json({ error: "No readable text found" }, { status: 400 });
    }

    let parsedResponse: DocumentClassification;
    try {
      parsedResponse = await postCloudagent<DocumentClassification>("/classify-document", { ocrText: rawText });
    } catch (agentError: unknown) {
      const message = agentError instanceof Error ? agentError.message : String(agentError);
      await logSmartUploadError("CLOUDAGENT_UNREACHABLE", message);
      const isNetwork =
        message.includes("fetch failed") ||
        message.includes("ECONNREFUSED") ||
        message.includes("ENOTFOUND") ||
        message.includes("timed out");
      return NextResponse.json(
        {
          error: isNetwork
            ? "Cloudflare Cloudagent is not reachable. Check AGENT_URL and worker deployment."
            : "Cloudflare Cloudagent request failed.",
          details: message,
        },
        { status: 502 },
      );
    }

    if (parsedResponse.error) {
      await logSmartUploadError("CLOUDAGENT_ERROR", parsedResponse.error);
      return NextResponse.json({ error: parsedResponse.error }, { status: 502 });
    }

    if (!parsedResponse.documentType && !parsedResponse.status) {
      await logSmartUploadError("AI_JSON_INVALID", "Classifier response missing expected fields.");
      return NextResponse.json({ error: "Cloudagent classifier returned an unexpected response." }, { status: 500 });
    }

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
    const resolvedFileType =
      !hasGenericAiType && classifiedType ? classifiedType : String(type || "").trim() || classifiedType || "Unknown";

    const savePayload = {
      storageId,
      userId: clerkUserId,
      fileName,
      mrn: linkedMrn && linkedMrn !== "none" && linkedMrn !== "Unlinked" ? linkedMrn : undefined,
      declarationId: linkedDeclarationId && linkedDeclarationId !== "none" ? (linkedDeclarationId as never) : undefined,
      auditStatus: String(parsedResponse.status || "pending").toLowerCase(),
      fileType: resolvedFileType,
      ocrText: rawText,
    };

    const newDocId = replaceDocumentId
      ? await convex.mutation(api.documents.replaceDocument, {
          documentId: replaceDocumentId as never,
          ...savePayload,
        })
      : await convex.mutation(api.documents.saveDocument, savePayload);

    return NextResponse.json({
      success: true,
      documentId: (newDocId as { documentId?: string })?.documentId || newDocId,
      analysis: parsedResponse,
      ocrText: rawText,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unhandled error";
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
              message,
            },
          });
        }
      }
    } catch {
      // no-op
    }
    return NextResponse.json({ error: "Internal Server Error", details: message }, { status: 500 });
  }
}
