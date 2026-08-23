import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { fetchHmrc } from "../../../../../lib/hmrc-fetch";
import {
  buildFileUploadGroupRequestXml,
  HMRC_DOCUMENT_MAX_BYTES,
  parseFileUploadResponseGroup,
  postFileToHmrcS3,
} from "../../../../../lib/hmrc-document-upload";
import { FileUploadGroupError, HMRC_FILE_UPLOAD_MAX_GROUP } from "../../../../../lib/hmrc-file-upload";
import { resolveDocumentType } from "../../../../../lib/hmrc-supporting-evidence";
import { getAuthenticatedConvex } from "../../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForDeclaration } from "../../../../../lib/hmrc-org-routing";
import { resolveHmrcAccessToken } from "../../../../../lib/hmrc-token";
import { logHmrcAudit } from "../../../../../lib/audit-log";

/**
 * POST /api/hmrc/documents/upload
 *
 * CDS §4.3 — initiate a file-upload group, then POST each file to its own
 * Upscan S3 target from the server (avoids browser CORS).
 *
 * Source, retrieved 2026-08-23:
 * https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 *
 * Form fields:
 *   declarationId              required
 *   file                       one or more; repeat the field for a group
 *   documentType[i]            optional, per file, aligned by index
 *   requestDescription[i]      optional, the DMSDOC StatementDescription this
 *                              file answers — used when no type was chosen
 *
 * **One initiate covers the whole group.** HMRC accepts up to 11 files per
 * request and returns a separate `Reference` and upload target for each, in
 * request order. Uploading three files previously meant three initiate calls,
 * which produced three unrelated batches for what is one response to one
 * documentary check.
 *
 * Each S3 upload then succeeds or fails on its own, and the response reports
 * per file. A group is never reported as successful because most of it worked.
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
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);
    const documentTypes = formData.getAll("documentType").map((v) => String(v ?? ""));
    const requestDescriptions = formData.getAll("requestDescription").map((v) => String(v ?? ""));

    if (typeof declarationId !== "string" || !declarationId) {
      return NextResponse.json({ error: "Missing declarationId" }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (files.length > HMRC_FILE_UPLOAD_MAX_GROUP) {
      return NextResponse.json(
        {
          error: `HMRC accepts at most ${HMRC_FILE_UPLOAD_MAX_GROUP} files per upload. Send them in smaller batches.`,
          maxGroupSize: HMRC_FILE_UPLOAD_MAX_GROUP,
        },
        { status: 400 },
      );
    }
    for (const file of files) {
      if (file.size <= 0) {
        return NextResponse.json({ error: `Empty file: ${file.name}` }, { status: 400 });
      }
      if (file.size > HMRC_DOCUMENT_MAX_BYTES) {
        return NextResponse.json(
          { error: `${file.name} exceeds the ${HMRC_DOCUMENT_MAX_BYTES} byte limit` },
          { status: 413 },
        );
      }
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

    // DocumentType is optional in HMRC's schema and has no published value
    // list, so it is echoed from the request or the user's choice, and omitted
    // when neither is reliable. It is never defaulted.
    const groupFiles = files.map((file, index) => ({
      fileSequenceNo: index + 1,
      documentType: resolveDocumentType({
        selected: documentTypes[index],
        requestDescription: requestDescriptions[index],
      }),
      file,
    }));

    let requestXml: string;
    try {
      requestXml = buildFileUploadGroupRequestXml({
        mrn,
        files: groupFiles.map(({ fileSequenceNo, documentType }) => ({
          fileSequenceNo,
          documentType,
        })),
      });
    } catch (error: unknown) {
      if (error instanceof FileUploadGroupError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

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

    const targets = parseFileUploadResponseGroup(bodyText);
    if (targets.length !== groupFiles.length) {
      // A target count that disagrees with the group would silently pair files
      // with the wrong Reference, so the whole group is refused instead.
      return NextResponse.json(
        {
          error: `HMRC returned ${targets.length} upload targets for ${groupFiles.length} files`,
          details: bodyText,
        },
        { status: 502 },
      );
    }
    if (targets.some((t) => !t.uploadHref || !t.hasUploadFields)) {
      return NextResponse.json(
        { error: "HMRC file-upload response missing S3 upload metadata", details: bodyText },
        { status: 502 },
      );
    }

    const conversationId = hmrcResponse.headers.get("X-Conversation-ID");
    const fileGroupSize = groupFiles.length;

    const results = [];
    for (const entry of groupFiles) {
      // Targets come back in request order, so sequence number indexes them.
      const target = targets[entry.fileSequenceNo - 1];
      const { file, fileSequenceNo, documentType } = entry;

      const fileBytes = await file.arrayBuffer();
      const s3Result = await postFileToHmrcS3({
        href: target.uploadHref!,
        fields: target.fields,
        fileBytes,
        fileName: file.name,
        contentType: file.type || undefined,
      });

      const base = {
        fileName: file.name,
        fileSize: file.size,
        fileSequenceNo,
        fileGroupSize,
        documentType,
        // HMRC's per-file Reference doubles as the ConversationId for that
        // file's outcome notification, so it is the correlation key.
        uploadReference: target.reference,
        s3Status: s3Result.status,
      };

      if (!s3Result.ok) {
        await logHmrcAudit(convex, userId, "cds_file_upload_s3_failed", {
          declarationId,
          mrn,
          conversationId,
          ...base,
        });
        results.push({
          ...base,
          success: false,
          error:
            s3Result.status === 410
              ? "Upload URL expired (410 Gone). Please retry."
              : `HMRC S3 upload failed (${s3Result.status} ${s3Result.statusText})`,
        });
        continue;
      }

      await logHmrcAudit(convex, userId, "cds_file_upload_completed", {
        declarationId,
        mrn,
        conversationId,
        ...base,
      });
      results.push({ ...base, success: true });
    }

    const sent = results.filter((r) => r.success).length;

    return NextResponse.json(
      {
        // Only true when every file in the group landed.
        success: sent === results.length,
        conversationId,
        fileGroupSize,
        sent,
        failed: results.length - sent,
        results,
      },
      // 207 tells the caller to read `results` rather than assume the group
      // succeeded or failed as a unit.
      { status: sent === results.length ? 200 : 207 },
    );
  } catch (error: unknown) {
    console.error("CDS file-upload crash:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
