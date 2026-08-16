"use client";

import { useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Download, ExternalLink, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EVIDENCE_KIND_LABELS, type EvidenceKind } from "@/lib/export-controls/draft-pack";
import { userMessageFromError } from "@/lib/convex-errors";

interface ExportEvidencePanelProps {
  assessmentId: Id<"export_assessments">;
}

const evidenceKinds = Object.keys(EVIDENCE_KIND_LABELS) as EvidenceKind[];

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ExportEvidencePanel({ assessmentId }: ExportEvidencePanelProps) {
  const { isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery = isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const detail = useQuery(api.export_controls.getAssessment, canQuery ? { assessmentId } : "skip");
  const documents = useQuery(
    api.export_controls.listAttachableDocuments,
    canQuery ? { assessmentId } : "skip",
  );
  const addEvidence = useMutation(api.export_controls.addExportEvidence);
  const removeEvidence = useMutation(api.export_controls.removeExportEvidence);

  const [kind, setKind] = useState<EvidenceKind>("technical_description");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [documentId, setDocumentId] = useState<string>("none");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evidence = detail?.evidence ?? [];
  const isWebPage = kind === "web_page";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await addEvidence({
        assessmentId,
        kind,
        label: label.trim(),
        documentId: documentId === "none" ? undefined : (documentId as Id<"documents">),
        url: url.trim() || undefined,
        note: note.trim() || undefined,
      });
      setLabel("");
      setNote("");
      setUrl("");
      setDocumentId("none");
    } catch (err: unknown) {
      setError(userMessageFromError(err, "Failed to add evidence"));
    } finally {
      setSaving(false);
    }
  };

  if (!detail) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading product evidence…
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-black">Product evidence for DBT</h2>
          <p className="mt-1 text-xs text-slate-500">
            Attach documents showing what each item is and what it does — specification, datasheet, brochure or
            product web page. These go with your SIEL / SITCL application alongside the EUSU.
          </p>
        </div>
      </div>

      {evidence.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {evidence.map((item) => (
            <li key={item._id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900">{item.label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {EVIDENCE_KIND_LABELS[item.kind as EvidenceKind]}
                  {item.fileName ? ` · ${item.fileName}` : ""}
                  {item.fileSize ? ` · ${formatSize(item.fileSize)}` : ""}
                </p>
                {item.note && <p className="mt-1 text-[11px] text-slate-500">{item.note}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {item.downloadUrl && (
                  <a
                    href={item.downloadUrl}
                    download={item.fileName ?? undefined}
                    className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                )}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void removeEvidence({ evidenceId: item._id })}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${item.label}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4 border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="evidence-kind" className="text-[11px] font-medium text-slate-600">
              Evidence type
            </label>
            <Select value={kind} onValueChange={(value) => setKind(value as EvidenceKind)}>
              <SelectTrigger
                id="evidence-kind"
                className="mt-1 h-9 w-full border-slate-200 bg-white text-xs text-slate-800"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[110]">
                {evidenceKinds.map((option) => (
                  <SelectItem key={option} value={option} className="text-xs">
                    {EVIDENCE_KIND_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="evidence-label" className="text-[11px] font-medium text-slate-600">
              Description <span className="text-red-600">*</span>
            </label>
            <input
              id="evidence-label"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Pressure sensor PS-400 datasheet"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {isWebPage ? (
          <div>
            <label htmlFor="evidence-url" className="text-[11px] font-medium text-slate-600">
              Product web page URL
            </label>
            <input
              id="evidence-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="evidence-document" className="text-[11px] font-medium text-slate-600">
              Uploaded document
            </label>
            <Select value={documentId} onValueChange={setDocumentId}>
              <SelectTrigger
                id="evidence-document"
                className="mt-1 h-9 w-full border-slate-200 bg-white text-xs text-slate-800"
              >
                <SelectValue placeholder="Select a document" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[110]">
                <SelectItem value="none" className="text-xs">
                  None — provide a URL instead
                </SelectItem>
                {(documents ?? []).map((doc) => (
                  <SelectItem key={doc._id} value={doc._id} className="text-xs">
                    {doc.fileName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-slate-400">
              Upload files on the Documents tab first — they appear here.
            </p>
            {documentId === "none" && (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… (link instead of a file)"
                className="mt-2 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
              />
            )}
          </div>
        )}

        <div>
          <label htmlFor="evidence-note" className="text-[11px] font-medium text-slate-600">
            Note (optional)
          </label>
          <input
            id="evidence-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What this document shows"
            className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400"
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={!canQuery || saving || !label.trim()}
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add evidence
        </button>
      </form>
    </section>
  );
}
