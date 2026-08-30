"use client";

/**
 * HMRC supporting evidence — Secure Upload.
 *
 * Sources, retrieved 2026-08-23:
 * - https://developer.service.hmrc.gov.uk/guides/customs-declarations-end-to-end-service-guide/documentation/uploading-supporting-documents.html
 * - https://www.gov.uk/guidance/send-documents-to-support-declarations-for-the-customs-declaration-service
 *
 * Two modes, decided by whether HMRC has asked for anything:
 *
 * **Documentary check.** A DMSDOC notification names the documents HMRC wants.
 * Each is listed with what FreightCode already holds against it, and a file is
 * attached per line. The whole set goes to HMRC as one group.
 *
 * **Proactive.** With no open check, the plain uploader stands — HMRC permits
 * files to be sent at any time.
 *
 * Files are sent as one group of up to 11, so a three-document response to one
 * documentary check is one HMRC batch rather than three unrelated ones. Each
 * file's outcome is tracked separately; the set is not reported as sent
 * because most of it was.
 */

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertCircle,
  CheckCircle2,
  File as FileIcon,
  FileText,
  Loader2,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  ConvexSessionMissing,
  DeclarationPageSkeleton,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";
import { HMRC_FILE_UPLOAD_MAX_GROUP } from "@/lib/hmrc-file-upload";

/** One line of the response being assembled against a documentary check. */
interface EvidenceLine {
  statementCode?: string;
  description?: string;
  goodsItemNumber?: number;
  matchedBy: string;
  heldFileName?: string;
  file?: File;
  outcome?: { success: boolean; error?: string; reference?: string | null };
}

interface UploadResult {
  fileName: string;
  fileSequenceNo: number;
  success: boolean;
  error?: string;
  uploadReference?: string | null;
  documentType?: string;
}

export default function DocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;

  const ready = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && Boolean(id);

  const declaration = useQuery(api.declarations.getLane, ready ? { id } : "skip");
  const documentaryRequest = useQuery(
    api.supporting_evidence.getDocumentaryRequest,
    ready ? { declarationId: id } : "skip",
  );
  const sentFiles = useQuery(
    api.supporting_evidence.listEvidenceUploads,
    ready ? { declarationId: id } : "skip",
  );
  const trackUpload = useMutation(api.documents.trackUpload);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lines, setLines] = useState<EvidenceLine[] | null>(null);
  const [proactiveFiles, setProactiveFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  if (isConvexSessionMissing(isLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated)) {
    return <ConvexSessionMissing />;
  }
  if (declaration === undefined) return <DeclarationPageSkeleton />;
  if (!declaration) return null;

  const mrn = String(declaration.mrn ?? "").trim();
  const isLocked = !mrn;

  // Seed the response lines from HMRC's request the first time it arrives.
  const requestItems = documentaryRequest?.items ?? [];
  const hasRequest = Boolean(documentaryRequest);
  const activeLines: EvidenceLine[] =
    lines ??
    requestItems.map((item) => ({
      statementCode: item.request?.statementCode,
      description: item.request?.description,
      goodsItemNumber: item.request?.goodsItemNumber,
      matchedBy: item.matchedBy,
      heldFileName: item.fileName,
    }));

  const setLineFile = (index: number, file: File | undefined) => {
    const next = [...activeLines];
    next[index] = { ...next[index], file, outcome: undefined };
    setLines(next);
  };

  const send = async (
    payload: Array<{ file: File; documentType?: string; requestDescription?: string; statementCode?: string }>,
  ) => {
    if (payload.length === 0) {
      setUploadError("Attach at least one file before sending.");
      return;
    }
    if (payload.length > HMRC_FILE_UPLOAD_MAX_GROUP) {
      setUploadError(
        `HMRC accepts at most ${HMRC_FILE_UPLOAD_MAX_GROUP} files per submission. Send them in smaller batches.`,
      );
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setResults(null);

    try {
      const form = new FormData();
      form.append("declarationId", id);
      // Repeated fields stay index-aligned, which is what pairs a file with its
      // DocumentType and with the request line it answers.
      for (const entry of payload) {
        form.append("file", entry.file);
        form.append("documentType", entry.documentType ?? "");
        form.append("requestDescription", entry.requestDescription ?? "");
      }

      const response = await fetch("/api/hmrc/documents/upload", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 207) {
        setUploadError(data?.error || "Unable to send documents to HMRC.");
        return;
      }

      const uploadResults: UploadResult[] = data.results ?? [];
      setResults(uploadResults);

      // Record only what actually landed. A failed file has no HMRC reference,
      // so writing a row for it would claim evidence that was never received.
      for (const [index, result] of uploadResults.entries()) {
        if (!result.success) continue;
        await trackUpload({
          declarationId: id,
          fileName: result.fileName,
          fileSize: payload[index]?.file.size ?? 0,
          documentType: result.documentType,
          uploadStatus: "uploaded",
          hmrcUploadReference: result.uploadReference ?? undefined,
          hmrcConversationId: data.conversationId ?? undefined,
          fileSequenceNo: result.fileSequenceNo,
          fileGroupSize: data.fileGroupSize,
          requestedStatementCode: payload[index]?.statementCode,
        });
      }

      if (hasRequest) {
        setLines(
          activeLines.map((line) => {
            const matchIndex = payload.findIndex((p) => p.file === line.file);
            if (matchIndex < 0) return line;
            const result = uploadResults[matchIndex];
            return {
              ...line,
              outcome: result
                ? { success: result.success, error: result.error, reference: result.uploadReference }
                : undefined,
            };
          }),
        );
      } else {
        setProactiveFiles([]);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const attachedCount = activeLines.filter((l) => l.file).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Supporting evidence</h2>
        <p className="mt-1 text-xs text-slate-500">
          Files are sent to HMRC&apos;s Secure Document Environment against {mrn || "this declaration"}.
          Up to {HMRC_FILE_UPLOAD_MAX_GROUP} per submission, 10 MB each. PDF, JPEG, PNG or TXT.
        </p>
      </div>

      {isLocked && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="text-sm font-semibold text-yellow-800">MRN required</h3>
          <p className="mt-1 text-xs text-yellow-700">
            Documents are keyed against the MRN, so the declaration must be submitted and cleared by
            CDS before evidence can be sent.
          </p>
        </div>
      )}

      {uploadError && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 text-red-600" />
            <p className="text-xs text-red-700">{uploadError}</p>
          </div>
        </div>
      )}

      {results && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {results.filter((r) => r.success).length} of {results.length} sent successfully
          </p>
          {results.some((r) => !r.success) && (
            <p className="mt-1 text-xs text-slate-600">
              Failed files can be retried on their own — the ones that landed are not resent.
            </p>
          )}
        </div>
      )}

      {hasRequest ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-amber-50/60 px-6 py-4">
            <h3 className="text-sm font-semibold text-amber-900">HMRC documentary check</h3>
            <p className="mt-1 text-xs text-amber-800">
              HMRC has requested supporting evidence for {documentaryRequest?.mrn || mrn}.
              {documentaryRequest?.issueDateTime
                ? ` Raised ${new Date(documentaryRequest.issueDateTime).toLocaleString("en-GB")}.`
                : ""}
            </p>
          </div>

          {activeLines.length === 0 ? (
            <p className="px-6 py-4 text-xs text-slate-500">
              HMRC has raised a documentary check but named no specific documents. Send whatever the
              check refers to using the uploader below.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeLines.map((line, index) => (
                <li key={`${line.statementCode ?? "line"}-${index}`} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {line.description || line.statementCode || "Document requested"}
                        </p>
                        {line.statementCode && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                            {line.statementCode}
                          </span>
                        )}
                        {line.goodsItemNumber !== undefined && (
                          <span className="text-[11px] text-slate-500">
                            Goods item {line.goodsItemNumber}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {line.heldFileName
                          ? `Held: ${line.heldFileName}`
                          : line.matchedBy === "unmatched"
                            ? "No matching document on this declaration — attach the file."
                            : "Matched to a declaration document, but no file is held."}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {line.outcome?.success ? (
                        <span className="flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Sent
                        </span>
                      ) : line.outcome && !line.outcome.success ? (
                        <span
                          className="flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700"
                          title={line.outcome.error}
                        >
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : null}

                      <label className="cursor-pointer rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        {line.file ? line.file.name : "Attach file"}
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.txt"
                          disabled={isLocked || isUploading}
                          onChange={(e) => setLineFile(index, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-500">
              {attachedCount} of {activeLines.length} attached. All attached files are sent to HMRC
              as one group.
            </p>
            <button
              type="button"
              disabled={isLocked || isUploading || attachedCount === 0}
              onClick={() =>
                send(
                  activeLines
                    .filter((l): l is EvidenceLine & { file: File } => Boolean(l.file))
                    .map((l) => ({
                      file: l.file,
                      requestDescription: l.description,
                      statementCode: l.statementCode,
                    })),
                )
              }
              className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {isUploading ? "Sending…" : "Send selected documents to HMRC"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${isLocked ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="p-8">
            <div className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 transition-colors hover:bg-slate-50">
              <input
                type="file"
                multiple
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                accept=".pdf,.jpg,.jpeg,.png,.txt"
                disabled={isLocked || isUploading}
                onChange={(e) => {
                  setProactiveFiles(Array.from(e.target.files ?? []));
                  if (e.target) e.target.value = "";
                }}
              />
              {isUploading ? (
                <div className="flex flex-col items-center text-center">
                  <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm font-medium text-slate-900">Sending to HMRC</p>
                  <p className="mt-1 text-xs text-slate-500">Awaiting anti-virus scan results</p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                    <UploadCloud className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Click or drag files to send supporting evidence
                  </h3>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    HMRC has not raised a documentary check on this declaration. Evidence may still
                    be sent at any time.
                  </p>
                </div>
              )}
            </div>

            {proactiveFiles.length > 0 && (
              <div className="mt-6 space-y-3">
                <ul className="space-y-2">
                  {proactiveFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
                    >
                      <FileIcon className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-slate-900">{file.name}</span>
                      <span className="text-xs text-slate-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => send(proactiveFiles.map((file) => ({ file })))}
                  className="rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {isUploading
                    ? "Sending…"
                    : `Send ${proactiveFiles.length} file${proactiveFiles.length === 1 ? "" : "s"} to HMRC`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {(sentFiles?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Sent to HMRC
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Each file carries its own HMRC reference — the identifier its outcome notification
              arrives under.
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {(sentFiles ?? []).map((doc) => (
              <li key={doc._id} className="flex items-start justify-between gap-3 px-6 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{doc.fileName}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {doc.hmrcUploadReference}
                      {doc.fileGroupSize && doc.fileGroupSize > 1
                        ? ` · file ${doc.fileSequenceNo} of ${doc.fileGroupSize}`
                        : ""}
                      {doc.requestedStatementCode ? ` · ${doc.requestedStatementCode}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                  {doc.status ?? "Uploaded"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
