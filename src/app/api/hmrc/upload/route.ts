import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";
import { HMRC_CONFIG } from "../../../../lib/hmrc-config";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storageId, mrn, documentType } = await request.json();

    if (!storageId || !mrn) {
      return NextResponse.json({ error: "storageId and mrn are required fields to sync with HMRC" }, { status: 400 });
    }

    console.log(`[HMRC Document Sync] Preparing to sync document ${storageId} for MRN ${mrn}...`);

    const hmrcBase = process.env.HMRC_ENVIRONMENT === "sandbox"
      ? HMRC_CONFIG.sandboxBaseUrl
      : HMRC_CONFIG.productionBaseUrl;
    const hmrcUploadEndpoint = process.env.HMRC_DOCUMENT_UPLOAD_URL || `${hmrcBase}/customs/declarations/document-upload`;
    const tokenRecord = await convex.query(api.hmrc.getToken, { userId });
    const hmrcBearer = tokenRecord?.accessToken;

    if (!hmrcBearer) {
      return NextResponse.json({ error: "HMRC OAuth Token not found. Please connect your account." }, { status: 403 });
    }

    const hmrcRes = await fetchHmrc(hmrcUploadEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/xml",
      },
      body: `<DocumentUpload><MRN>${mrn}</MRN><DocumentType>${documentType || "Unknown"}</DocumentType><StorageId>${storageId}</StorageId></DocumentUpload>`,
    }, request, hmrcBearer);

    if (hmrcRes.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached, please try again shortly" }, { status: 429 });
    }
    if (hmrcRes.status === 410) {
      return NextResponse.json({ error: "Upload URL expired. Request a new upload session." }, { status: 410 });
    }
    if (!hmrcRes.ok) {
      const errorText = await hmrcRes.text();
      return NextResponse.json({ error: "Failed to upload XML wrapper to HMRC", details: errorText }, { status: hmrcRes.status });
    }

    console.log(`[HMRC Document Sync] Successfully linked Document (Type: ${documentType || 'Unknown'}) to Declaration (MRN: ${mrn}).`);

    return NextResponse.json({ 
      success: true, 
      message: "Document successfully queued for upstream HMRC Submission",
      mrn
    });

  } catch (error: any) {
    console.error("HMRC Upload Error:", error);
    return NextResponse.json({ error: "Failed to upload document to HMRC", details: error.message }, { status: 500 });
  }
}
