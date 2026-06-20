import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import {
  buildFileUploadRequestXml,
  parseFileUploadResponse,
} from "../../../../../lib/hmrc-file-upload";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../../lib/audit-log";

/**
 * POST /api/hmrc/documents/initiate
 * CDS §4.3 — POST /customs/declarations/file-upload → S3 presigned POST fields.
 */
export async function POST(request: Request) {
  try {
    const clerkAuth = await auth();
    const session = await getAuthenticatedConvex(clerkAuth);
    if ("error" in session) {
      return session.error;
    }
    const { convex, userId } = session;

    const { declarationId, fileName, fileSize, documentType } = await request.json();
    if (!declarationId || !fileName || !fileSize) {
      return NextResponse.json({ error: "Missing required document metadata" }, { status: 400 });
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

    const tokenResult = await resolveHmrcAccessToken(convex, userId);
    if ("error" in tokenResult) {
      return tokenResult.error;
    }

    const orgRouting = await resolveOrgHmrcRoutingForDeclaration(
      convex,
      declarationId as Id<"declarations">,
    );
    if ("error" in orgRouting) {
      return orgRouting.error;
    }
    const { hmrcContext } = orgRouting;

    const initiateUrl = `${hmrcContext.apiBaseUrl}/customs/declarations/file-upload`;
    const docType = typeof documentType === "string" && documentType.trim() ? documentType.trim() : "invoice";
    const requestXml = buildFileUploadRequestXml({ mrn, documentType: docType });

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

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    await logHmrcAudit(convex, userId, "cds_file_upload_initiated", {
      declarationId,
      mrn,
      fileName,
      fileSize,
      documentType: docType,
      conversationId,
      uploadReference: parsed.reference,
    });

    return NextResponse.json({
      success: true,
      conversationId,
      uploadReference: parsed.reference,
      uploadParameters: {
        href: parsed.uploadHref,
        fields: parsed.fields,
      },
      fileName,
      fileSize,
      documentType: docType,
    });
  } catch (error: unknown) {
    console.error("CDS file-upload initiate crash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
