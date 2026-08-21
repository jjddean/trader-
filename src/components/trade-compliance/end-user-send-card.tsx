"use client";

import { useState } from "react";
import { Download, Loader2, Mail, Printer, Send, Upload } from "lucide-react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  downloadEndUserStatementHtml,
  openEndUserStatementPrintDialog,
  type EndUserStatementInput,
  type EusuDetails,
} from "@/lib/export-controls/end-user-statement";
import { ApiError, userMessageFromError } from "@/lib/convex-errors";

interface EndUserSendCardProps {
  assessmentId: Id<"export_assessments">;
  /** send = Draft Pack form. result = Overview completed state only. */
  variant?: "send" | "result";
}

export function EndUserSendCard({ assessmentId, variant = "send" }: EndUserSendCardProps) {
  const { isAuthenticated } = useConvexAuth();
  const { user } = useUser();

  const status = useQuery(
    api.compliance_end_user.getEndUserDispatchStatus,
    isAuthenticated ? { assessmentId } : "skip",
  );
  const detail = useQuery(
    api.export_controls.getAssessment,
    isAuthenticated ? { assessmentId } : "skip",
  );
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const discardOrphanedUpload = useMutation(api.documents.discardOrphanedUpload);
  const saveDocument = useMutation(api.documents.saveDocument);
  const addEvidence = useMutation(api.export_controls.addExportEvidence);

  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderNote, setSenderNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const statement = status?.statement as
    | {
        endUserName?: string;
        endUserAddress?: string;
        endUserCountry?: string;
        contactName?: string;
        contactEmail?: string;
        intendedUse?: string;
        signedBy?: string;
        signedAt?: number;
        eusu?: EusuDetails;
      }
    | null
    | undefined;
  const isComplete = Boolean(statement) || Boolean(status?.latestToken?.completedAt);

  const signedEvidence = (detail?.evidence ?? []).filter((item) => item.kind === "eusu_signed");

  const printInput: EndUserStatementInput | null =
    statement && detail?.assessment
      ? {
          assessmentReference: detail.assessment.reference,
          destinationCountry: detail.assessment.destinationCountry,
          products: detail.products.map((p) => ({
            name: p.name,
            techDescription: p.techDescription,
            quantity: p.quantity,
          })),
          endUserName: statement.endUserName ?? "",
          endUserAddress: statement.endUserAddress ?? "",
          endUserCountry: statement.endUserCountry ?? "",
          contactName: statement.contactName ?? "",
          contactEmail: statement.contactEmail,
          intendedUse: statement.intendedUse ?? "",
          signedBy: statement.signedBy ?? "",
          signedAt: statement.signedAt ?? 0,
          eusu: statement.eusu,
        }
      : null;

  const handleCompletedDoc = (mode: "print" | "download") => {
    if (!printInput) return;
    if (mode === "print") openEndUserStatementPrintDialog(printInput);
    else downloadEndUserStatementHtml(printInput);
  };

  const handleSignedUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    let uploadedStorageId: Id<"_storage"> | null = null;
    try {
      const postUrl = await generateUploadUrl();
      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResult.ok) throw new Error("Upload failed");
      const { storageId } = await uploadResult.json();
      uploadedStorageId = storageId;

      const documentId = await saveDocument({
        storageId,
        userId: user?.id || "unknown",
        fileName: file.name,
        fileType: "eusu_signed",
        auditStatus: "not_required",
      });

      await addEvidence({
        assessmentId,
        kind: "eusu_signed",
        label: `Signed EUSU — ${statement?.endUserName ?? "end user"}`,
        documentId,
      });
    } catch (err: unknown) {
      if (uploadedStorageId) {
        try {
          await discardOrphanedUpload({ storageId: uploadedStorageId });
        } catch (discardErr) {
          console.error("[upload] failed to discard orphaned upload", discardErr);
        }
      }
      setUploadError(userMessageFromError(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  if (variant === "result") {
    if (!isComplete) return null;
    return (
      <section className="rounded-xl border border-green-200 bg-green-50 p-5">
        <h2 className="text-sm font-semibold text-green-900">End-user and stockist undertaking (EUSU)</h2>
        <p className="mt-2 text-xs font-medium text-green-900">
          Completed{statement?.endUserName ? ` — ${statement.endUserName}` : ""}
          {statement?.signedBy ? ` · signed by ${statement.signedBy}` : ""}
        </p>
        {statement?.signedAt && (
          <p className="mt-1 text-[11px] text-green-800">
            {new Date(statement.signedAt).toLocaleString("en-GB")}
          </p>
        )}
      </section>
    );
  }

  const handleSend = async () => {
    const email = recipientEmail.trim();
    if (!email) {
      setError("End-user email is required");
      return;
    }

    setSending(true);
    setError(null);
    setSentTo(null);

    try {
      const res = await fetch("/api/export-controls/send-to-end-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId,
          recipientEmail: email,
          senderNote: senderNote.trim() || undefined,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(body.error || "Send failed");
      setSentTo(body.recipientEmail ?? email);
    } catch (err: unknown) {
      setError(userMessageFromError(err, "Send failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-black">End-user and stockist undertaking (EUSU)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Send a secure link to the buyer / end user to complete the undertaking for your SIEL or SITCL
            application.{" "}
            <a
              href="https://www.gov.uk/government/publications/end-user-undertaking-euu-form"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700"
            >
              Official EUSU form on GOV.UK
            </a>
          </p>
        </div>
      </div>

      {isComplete ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-900">
            <p className="font-medium">
              Statement completed{statement?.endUserName ? ` — ${statement.endUserName}` : ""}
            </p>
            {statement?.signedBy && <p className="mt-1 text-[11px]">Signed by {statement.signedBy}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCompletedDoc("print")}
                disabled={!printInput}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Printer className="h-3 w-3" />
                Print / save PDF
              </button>
              <button
                type="button"
                onClick={() => handleCompletedDoc("download")}
                disabled={!printInput}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                Download
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 px-4 py-3">
            <p className="text-xs font-medium text-slate-900">Signed official form</p>
            <p className="mt-1 text-[11px] text-slate-500">
              If the buyer returns the official GOV.UK form signed, upload it here — ECJU wants a non-editable PDF.
            </p>
            {signedEvidence.length > 0 && (
              <ul className="mt-3 space-y-2">
                {signedEvidence.map((item) => (
                  <li key={item._id} className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
                    <span className="min-w-0 truncate">{item.fileName ?? item.label}</span>
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        download={item.fileName ?? undefined}
                        className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? "Uploading…" : "Upload signed PDF"}
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleSignedUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadError && <p className="mt-2 text-[11px] text-red-700">{uploadError}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {/* Fixed height: the status only exists once the query resolves, so the slot is
              reserved to stop the form below shifting down. */}
          <p className="h-4 truncate text-[11px] leading-4 text-slate-500">
            {status?.activeToken
              ? `Active link sent to ${status.activeToken.recipientEmail} · expires ${new Date(
                  status.activeToken.expiresAt,
                ).toLocaleDateString("en-GB")}`
              : ""}
          </p>

          <div>
            <label htmlFor="end-user-email" className="text-[11px] font-medium text-slate-600">
              End-user email <span className="text-red-600">*</span>
            </label>
            <input
              id="end-user-email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="buyer@example.com"
              className="mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-slate-400"
            />
          </div>

          <textarea
            value={senderNote}
            onChange={(e) => setSenderNote(e.target.value)}
            rows={2}
            placeholder="Optional note for the end user…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs outline-none focus:border-slate-400"
          />

          {error && <p className="text-xs text-red-700">{error}</p>}

          {sentTo && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <p className="font-medium text-slate-700">Sent to {sentTo}</p>
              <p className="mt-1 text-slate-600">The one-time access link was delivered by email.</p>
            </div>
          )}

          <button
            type="button"
            disabled={sending || !recipientEmail.trim()}
            onClick={() => void handleSend()}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send to end user
          </button>
        </div>
      )}
    </section>
  );
}
