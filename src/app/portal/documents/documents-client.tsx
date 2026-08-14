"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { AlertTriangle, Download, FolderOpen, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPES,
  docTypeName,
  inferDocTypeCode,
} from "@/lib/utils/document-utils";

const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

function uploadCategoryForDocumentType(documentType: string) {
  const normalized = documentType.trim().toUpperCase();
  if (normalized === "N935") return "invoice";
  if (normalized === "N271") return "packing_list";
  if (["N864", "N865", "U166", "U101", "U164", "9100"].includes(normalized)) {
    return "certificate";
  }
  return "portal_upload";
}

/** Documents library — list, download, upload here. No bounce to declaration detail. */
export default function PortalDocumentsClient({
  initialRequirementId,
}: {
  initialRequirementId?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const documents = useQuery(api.client_portal.listMyDocuments, authReady ? {} : "skip");
  const requestedRequirement = useQuery(
    api.client_portal.getMyDocumentRequirement,
    authReady && initialRequirementId ? { requirementId: initialRequirementId } : "skip",
  );
  const getDownloadUrl = useMutation(api.client_portal.getMyDocumentDownloadUrl);
  const generateUploadUrl = useMutation(api.client_portal.generateMyUploadUrl);
  const saveDocument = useMutation(api.client_portal.saveMyDocument);

  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("N935");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [completedRequirementId, setCompletedRequirementId] = useState<string | null>(null);

  const targetRequirement =
    completedRequirementId !== initialRequirementId && initialRequirementId
      ? (requestedRequirement ?? undefined)
      : undefined;
  const requirementIsLoading = Boolean(initialRequirementId && requestedRequirement === undefined);
  const requirementWasCompleted = Boolean(
    initialRequirementId && completedRequirementId === initialRequirementId,
  );
  const requirementIsUnavailable = Boolean(
    initialRequirementId &&
      requestedRequirement !== undefined &&
      !targetRequirement &&
      !requirementWasCompleted,
  );
  const activeDocumentType = String(targetRequirement?.code ?? documentType).toUpperCase();

  const handleDownload = async (documentId: Id<"documents">) => {
    setDownloadBusyId(documentId);
    setDownloadError(null);
    try {
      const url = await getDownloadUrl({ documentId });
      if (!url) {
        setDownloadError("That file is no longer available. Ask your broker to re-send it.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadBusyId(null);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const postUrl = await generateUploadUrl(
        targetRequirement ? { declarationId: targetRequirement.declarationId } : {},
      );
      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResult.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> };
      await saveDocument({
        storageId,
        ...(targetRequirement
          ? {
              declarationId: targetRequirement.declarationId,
              requirementId: targetRequirement._id,
            }
          : {}),
        fileName: file.name,
        category: uploadCategoryForDocumentType(activeDocumentType),
        fileType: activeDocumentType,
      });
      if (targetRequirement) {
        setCompletedRequirementId(String(targetRequirement._id));
        setUploadNotice(
          `${targetRequirement.name || targetRequirement.code} sent to your broker for review.`,
        );
      } else {
        setUploadNotice(`${file.name} sent to your broker for review.`);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Documents</h1>
        <p className="mt-1 text-sm text-slate-500">Your files. Download or upload here.</p>
      </div>

      {targetRequirement ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
            strokeWidth={2.25}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-950">
              Your broker needs {targetRequirement.name || targetRequirement.code}
            </p>
            <p className="mt-0.5 text-xs text-amber-900">
              For {targetRequirement.mrn || "a filing awaiting its MRN"}
              {targetRequirement.requirementLevel === "blocking"
                ? " · required before this filing can proceed"
                : ""}
            </p>
            {targetRequirement.hmrcGuidance ? (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-900">
                {targetRequirement.hmrcGuidance}
              </p>
            ) : null}
          </div>
        </div>
      ) : requirementWasCompleted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          The requested document has been sent to your broker for review.
        </div>
      ) : requirementIsUnavailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          This document request is no longer outstanding. You can still send an unlinked document
          to your broker below.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-medium text-black">Upload</h2>
          <p className="text-[11px] text-slate-500">
            {targetRequirement
              ? "This upload will answer the broker request above."
              : "Send a document to your broker."}
          </p>
        </div>
        <div className="space-y-3 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[220px]">
              <label className={FIELD_LABEL} htmlFor="portal-docs-type">
                Type
              </label>
              {targetRequirement ? (
                <p
                  id="portal-docs-type"
                  className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700"
                >
                  {targetRequirement.name || docTypeName(activeDocumentType)} ({activeDocumentType})
                </p>
              ) : (
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="portal-docs-type" className={ENTERPRISE_SELECT_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    collisionPadding={12}
                    className={`${ENTERPRISE_SELECT_CONTENT} !max-h-[240px]`}
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem
                        key={type.code}
                        value={type.code}
                        className={ENTERPRISE_SELECT_ITEM}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <label
              className={cn(
                "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800",
                (uploading || requirementIsLoading) && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Choose file
              <input
                type="file"
                className="hidden"
                disabled={uploading || requirementIsLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void handleUpload(file);
                }}
              />
            </label>
          </div>
          {uploadNotice && (
            <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {uploadNotice}
            </div>
          )}
          {uploadError && (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
              {uploadError}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
        {downloadError && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-2.5 text-xs text-red-800">
            {downloadError}
          </div>
        )}
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  File
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Status
                </th>
                <th className="w-[110px] px-6 py-3 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {documents === undefined ? (
                <tr>
                  <td colSpan={4} className="h-24" aria-hidden />
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="flex flex-col items-center py-10 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <FolderOpen className="h-4 w-4 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">No documents yet</h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        Upload a file above. Your broker can attach it to a filing later.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-xs text-slate-900">{doc.fileName}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {docTypeName(inferDocTypeCode(doc.fileType || doc.fileName))}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {doc.mrn
                        ? `Linked to ${doc.mrn}`
                        : doc.declarationId
                          ? "Added to filing"
                          : "Sent to broker"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDownload(doc._id)}
                        disabled={downloadBusyId === doc._id || !doc.hasFile}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {downloadBusyId === doc._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Download
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
