"use client";

import { useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Download, FolderOpen, Loader2, Upload } from "lucide-react";
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
import { formatPortalFilingLabel } from "@/components/portal/portal-status";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";
import { cn } from "@/lib/utils";

const FIELD_LABEL =
  "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";

const UPLOAD_CATEGORIES = [
  { value: "invoice", label: "Commercial invoice" },
  { value: "packing_list", label: "Packing list" },
  { value: "certificate", label: "Supporting certificate" },
] as const;

/** Documents library — list, download, upload here. No bounce to declaration detail. */
export default function PortalDocumentsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const documents = useQuery(api.client_portal.listMyDocuments, authReady ? {} : "skip");
  const declarations = useQuery(api.client_portal.listMyDeclarations, authReady ? {} : "skip");
  const getDownloadUrl = useMutation(api.client_portal.getMyDocumentDownloadUrl);
  const generateUploadUrl = useMutation(api.client_portal.generateMyUploadUrl);
  const saveDocument = useMutation(api.client_portal.saveMyDocument);

  const [downloadBusyId, setDownloadBusyId] = useState<string | null>(null);
  const [declarationId, setDeclarationId] = useState<string>("");
  const [category, setCategory] = useState<(typeof UPLOAD_CATEGORIES)[number]["value"]>("invoice");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Default upload target to newest declaration once loaded.
  const resolvedDeclarationId =
    declarationId ||
    (declarations && declarations.length > 0 ? String(declarations[0]!._id) : "");

  const handleDownload = async (documentId: Id<"documents">) => {
    setDownloadBusyId(documentId);
    try {
      const url = await getDownloadUrl({ documentId });
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Mutation throws if no file attached.
    } finally {
      setDownloadBusyId(null);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file || !resolvedDeclarationId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const id = resolvedDeclarationId as Id<"declarations">;
      const postUrl = await generateUploadUrl({ declarationId: id });
      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResult.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadResult.json()) as { storageId: Id<"_storage"> };
      await saveDocument({
        storageId,
        declarationId: id,
        fileName: file.name,
        category,
        fileType: category,
      });
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-sm font-medium text-black">Upload</h2>
          <p className="text-[11px] text-slate-500">
            Choose a filing, document type, then pick a file.
          </p>
        </div>
        <div className="space-y-3 p-6">
          {!declarations?.length ? (
            <p className="text-xs text-slate-500">
              No declarations yet — your broker must link a filing before you can upload.
            </p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-[200px] flex-1">
                <label className={FIELD_LABEL} htmlFor="portal-docs-declaration">
                  Filing
                </label>
                <Select
                  value={resolvedDeclarationId}
                  onValueChange={(value) => setDeclarationId(value)}
                >
                  <SelectTrigger
                    id="portal-docs-declaration"
                    className={ENTERPRISE_SELECT_TRIGGER}
                  >
                    <SelectValue placeholder="Select filing" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                    {declarations.map((d) => (
                      <SelectItem key={d._id} value={d._id} className={ENTERPRISE_SELECT_ITEM}>
                        {formatPortalFilingLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[180px]">
                <label className={FIELD_LABEL} htmlFor="portal-docs-type">
                  Type
                </label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as (typeof UPLOAD_CATEGORIES)[number]["value"])
                  }
                >
                  <SelectTrigger id="portal-docs-type" className={ENTERPRISE_SELECT_TRIGGER}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                    {UPLOAD_CATEGORIES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className={ENTERPRISE_SELECT_ITEM}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800",
                  uploading && "pointer-events-none opacity-60",
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
                  disabled={uploading || !resolvedDeclarationId}
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    void handleUpload(file);
                  }}
                />
              </label>
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
                  Filing
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
                        Upload above when you have a filing linked.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc._id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono text-xs text-slate-900">{doc.fileName}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{doc.fileType || "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                      {doc.mrn || "—"}
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
