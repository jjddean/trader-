import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { fetchHmrc } from "../../../../lib/hmrc-fetch";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const { storageId, mrn, documentType } = await request.json();

    if (!storageId || !mrn) {
      return NextResponse.json({ error: "storageId and mrn are required fields to sync with HMRC" }, { status: 400 });
    }

    console.log(`[HMRC Document Sync] Preparing to sync document ${storageId} for MRN ${mrn}...`);

    const hmrcUploadEndpoint = process.env.HMRC_DOCUMENT_UPLOAD_URL || "https://test-api.service.hmrc.gov.uk/customs/declarations/document-upload";
    const hmrcBearer = process.env.HMRC_CDS_BEARER_TOKEN;

    if (!hmrcBearer) {
      return NextResponse.json({ error: "Missing HMRC_CDS_BEARER_TOKEN credential for actual secure upload." }, { status: 401 });
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
