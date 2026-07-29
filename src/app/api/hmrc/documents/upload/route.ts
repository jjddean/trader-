import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import {
  buildFileUploadRequestXml,
  HMRC_DOCUMENT_MAX_BYTES,
  parseFileUploadResponse,
  postFileToHmrcS3,
} from "../../../../../lib/hmrc-document-upload";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../../lib/audit-log";

/**
 * POST /api/hmrc/documents/upload
 * CDS §4.3 — initiate file-upload then POST to Upscan S3 from the server (avoids browser CORS).
 * Form fields: declarationId, file, documentType (optional, default invoice)
 */
export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) {
      return session.error;
    }
    const { convex, userId } = session;

    const formData = await request.formData();
    const declarationId = formData.get("declarationId");
    const file = formData.get("file");
    const documentTypeRaw = formData.get("documentType");

    if (typeof declarationId !== "string" || !declarationId) {
      return NextResponse.json({ error: "Missing declarationId" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    if (file.size > HMRC_DOCUMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${HMRC_DOCUMENT_MAX_BYTES} byte limit` },
        { status: 413 },
      );
    }

    const lane = await convex.query(api.declarations.getLane, {
      id: declarationId as Id<"declarations">,
    });
    if (!lane) {
      return NextResponse.json({ error: "Declaration not found or unauthorized" }, { status: 404 });
    }

    const mrn = String(lane.mrn || "").trim();
    if (!mrn) {
      return NextResponse.json(
        { error: "Declaration must have an MRN before CDS file upload" },
        { status: 400 },
      );
    }

    const eori = String(lane.eori || "").trim();
    if (!/^GB\d{12}$/.test(eori)) {
      return NextResponse.json(
        { error: "Declarant EORI on the declaration is missing or invalid (expected GB+12 digits)." },
        { status: 400 },
      );
    }

    const orgRouting = await resolveOrgHmrcRoutingForDeclaration(
      convex,
      declarationId as Id<"declarations">,
    );
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    const tokenResult = await resolveHmrcAccessToken(convex, userId, hmrcContext);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const docType =
      typeof documentTypeRaw === "string" && documentTypeRaw.trim()
        ? documentTypeRaw.trim()
        : "invoice";
    const requestXml = buildFileUploadRequestXml({ mrn, documentType: docType });

    const initiateUrl = `${hmrcContext.apiBaseUrl}/customs/declarations/file-upload`;

    const hmrcResponse = await fetchHmrc(
      initiateUrl,
      {
        method: "POST",
        headers: {
          Accept: hmrcContext.declarationsAccept,
          "Content-Type": "application/xml; charset=UTF-8",
          "X-Eori-Identifier": eori,
        },
        body: requestXml,
      },
      request,
      tokenResult.token,
      eori,
      hmrcContext,
    );

    if (hmrcResponse.status === 429) {
      return NextResponse.json({ error: "HMRC rate limit reached" }, { status: 429 });
    }

    const bodyText = await hmrcResponse.text();
    if (!hmrcResponse.ok) {
      return NextResponse.json(
        { error: "HMRC file-upload initiate failed", details: bodyText },
        { status: hmrcResponse.status },
      );
    }

    const parsed = parseFileUploadResponse(bodyText);
    if (!parsed.uploadHref || !parsed.hasUploadFields) {
      return NextResponse.json(
        { error: "HMRC file-upload response missing S3 upload metadata", details: bodyText },
        { status: 502 },
      );
    }

    const fileBytes = await file.arrayBuffer();
    const s3Result = await postFileToHmrcS3({
      href: parsed.uploadHref,
      fields: parsed.fields,
      fileBytes,
      fileName: file.name,
      contentType: file.type || undefined,
    });

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");

    if (s3Result.status === 410) {
      return NextResponse.json(
        { error: "Upload URL expired (410 Gone). Please retry." },
        { status: 410 },
      );
    }

    if (!s3Result.ok) {
      await logHmrcAudit(convex, userId, "cds_file_upload_s3_failed", {
        declarationId,
        mrn,
        fileName: file.name,
        fileSize: file.size,
        conversationId,
        s3Status: s3Result.status,
      });
      return NextResponse.json(
        {
          error: "HMRC S3 upload failed",
          s3Status: s3Result.status,
          s3StatusText: s3Result.statusText,
        },
        { status: 502 },
      );
    }

    await logHmrcAudit(convex, userId, "cds_file_upload_completed", {
      declarationId,
      mrn,
      fileName: file.name,
      fileSize: file.size,
      documentType: docType,
      conversationId,
      uploadReference: parsed.reference,
      s3Status: s3Result.status,
    });

    return NextResponse.json({
      success: true,
      conversationId,
      uploadReference: parsed.reference,
      fileName: file.name,
      fileSize: file.size,
      documentType: docType,
      s3Status: s3Result.status,
    });
  } catch (error: unknown) {
    console.error("CDS file-upload crash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
