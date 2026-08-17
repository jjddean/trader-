"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ExternalLink, ChevronRight } from "lucide-react";
import type { TreParsePreview } from "@/lib/tre-csv-types";
import { TRE_FORMAT_LABELS } from "@/lib/tre-csv-types";
import { parseTreCsv, TRE_IMPORT_MAX_BYTES } from "@/lib/tre-csv-parser";
import { cn } from "@/lib/utils";
import { userMessageFromError } from "@/lib/convex-errors";

interface ImportSuccess {
  lineItemsStored: number;
  lineItemsSkipped: number;
  rowCount: number;
}

export function TreImportUpload({ embedded = false }: { embedded?: boolean }) {
  const { organization } = useOrganization();
  const imports = useQuery(api.tre_imports.listImports);
  const [preview, setPreview] = useState<TreParsePreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileRef, setFileRef] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<ImportSuccess | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<Id<"tre_imports"> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const importRows = useQuery(
    api.tre_imports.listImportRows,
    selectedImportId ? { importId: selectedImportId } : "skip",
  );
  const selectedImport = imports?.find((row) => row._id === selectedImportId);
  const reset = useCallback(() => {
    setPreview(null);
    setFileName(null);
    setFileRef(null);
    setError(null);
    setSuccess(null);
  }, []);

  // Pop the result into view so the user doesn't have to scroll to find it.
  useEffect(() => {
    if (preview || success) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [preview, success]);

  async function handleFile(file: File) {
    reset();
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file exported from HMRC TRE.");
      return;
    }
    if (file.size > TRE_IMPORT_MAX_BYTES) {
      setError("File exceeds 10 MB limit.");
      return;
    }

    const text = await file.text();
    const parsed = parseTreCsv(text);
    setPreview(parsed);
    setFileName(file.name);
    setFileRef(file);

    if (parsed.format === "unknown") {
      setError("This file does not look like a supported HMRC TRE report CSV.");
    }
  }

  async function handleCommit() {
    if (!fileRef || !preview) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", fileRef);
      formData.append("mode", "commit");

      const res = await fetch("/api/tre/import", { method: "POST", body: formData });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Import failed");
      }

      setSuccess(body.result as ImportSuccess);
      setPreview(null);
      setFileRef(null);
    } catch (err) {
      setError(userMessageFromError(err, "Import failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={embedded ? "space-y-6" : "space-y-8"}>
      {!organization && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Select an organisation workspace before importing. TRE history is shared with your team.
        </div>
      )}

      <div className={embedded ? "space-y-6" : "rounded-xl border border-slate-200 bg-white p-6"}>
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-black">Upload HMRC TRE CSV</h2>
          <p className="text-xs leading-relaxed text-slate-500">
            Export from HMRC Trade Reporting and Extracting (TRE): <strong>Import Item</strong>,{" "}
            <strong>Import Header</strong>, <strong>Import Tax Lines</strong>, or <strong>Export Item</strong>{" "}
            reports. We store up to 1,000 rows per import for duty estimates, HS suggestions, and history audits.
          </p>
          <Link
            href="/guides/how-to-read-cds-csv-export-tre"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            How to read your TRE CSV export
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <label
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
            preview ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <Upload className="mb-3 h-8 w-8 text-slate-400" />
          <span className="text-sm font-medium text-slate-800">Drop CSV here or click to browse</span>
          <span className="mt-1 text-xs text-slate-500">Max 10 MB · 1,000 rows stored per import</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>

        <div ref={resultRef} aria-hidden className="scroll-mt-24" />

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Imported {success.lineItemsStored} new line items
            {success.lineItemsSkipped > 0 ? ` (${success.lineItemsSkipped} duplicates skipped)` : ""} from{" "}
            {success.rowCount} parsed rows. Rate cache updated for your organisation.
          </div>
        )}

        {preview && (
          <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2 text-sm font-medium text-black">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
              {fileName}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Rows parsed", preview.rowCount],
                ["Will store", preview.storedRowCount],
                ["EORIs", preview.eoris.length],
                ["Format", TRE_FORMAT_LABELS[preview.format]],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">{label}</div>
                  <div className="text-sm font-semibold text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            {preview.warnings.length > 0 && (
              <ul className="space-y-1 text-xs text-amber-800">
                {preview.warnings.map((w, i) => (
                  <li key={i}>• {w.message}</li>
                ))}
              </ul>
            )}

            {preview.sampleRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-white text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">MRN</th>
                      <th className="px-3 py-2 font-medium">Commodity</th>
                      <th className="px-3 py-2 font-medium">Origin</th>
                      <th className="px-3 py-2 font-medium">Tax</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.sampleRows.map((row) => (
                      <tr key={row.sourceRowHash}>
                        <td className="px-3 py-2 font-mono text-[11px]">{row.entryIdentifierMrn}</td>
                        <td className="px-3 py-2">{row.commodityCode || "—"}</td>
                        <td className="px-3 py-2">{row.countryOfOriginCode || "—"}</td>
                        <td className="px-3 py-2">{row.taxType || "—"}</td>
                        <td className="px-3 py-2">{row.taxLineTotalAmount ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading || !organization || preview.format === "unknown" || preview.storedRowCount === 0}
                onClick={() => void handleCommit()}
                className="rounded-md bg-black px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Importing…" : "Confirm import"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Choose another file
              </button>
            </div>
          </div>
        )}
      </div>

      {imports && imports.length > 0 && (
        <div className={embedded ? "border-t border-slate-200 pt-6" : "rounded-xl border border-slate-200 bg-white p-6"}>
          <h3 className="mb-4 text-sm font-semibold text-black">Import history</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-white text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">File</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Stored</th>
                  <th className="px-3 py-2 font-medium">Skipped</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {imports.map((row) => {
                  const isSelected = selectedImportId === row._id;
                  return (
                    <tr
                      key={row._id}
                      className={cn(isSelected && "bg-slate-50")}
                    >
                      <td className="px-3 py-2 text-slate-600">
                        {new Date(row.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-3 py-2">{row.filename}</td>
                      <td className="px-3 py-2 capitalize">
                        {row.reportFormat ? String(row.reportFormat).replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2">{row.lineItemsStored}</td>
                      <td className="px-3 py-2">{row.lineItemsSkipped}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={row.lineItemsStored === 0}
                          onClick={() =>
                            setSelectedImportId(isSelected ? null : row._id)
                          }
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors",
                            row.lineItemsStored === 0
                              ? "cursor-not-allowed text-slate-300"
                              : isSelected
                                ? "bg-black text-white"
                                : "text-blue-600 hover:bg-slate-100 hover:text-blue-700",
                          )}
                        >
                          {isSelected ? "Hide" : "View"}
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 transition-transform",
                              isSelected && "rotate-90",
                            )}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedImportId && selectedImport && (
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-6">
              <div>
                <h4 className="text-sm font-semibold text-black">Stored line items</h4>
                <p className="mt-1 text-xs text-slate-500">
                  {selectedImport.filename} · {selectedImport.lineItemsStored} rows
                </p>
              </div>

              {importRows === undefined ? (
                <p className="text-xs text-slate-400">Loading rows…</p>
              ) : importRows.length === 0 ? (
                <p className="text-xs text-slate-500">No rows stored for this import.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">MRN</th>
                        <th className="px-3 py-2 font-medium">Commodity</th>
                        <th className="px-3 py-2 font-medium">Origin</th>
                        <th className="px-3 py-2 font-medium">Preference</th>
                        <th className="px-3 py-2 font-medium">Tax</th>
                        <th className="px-3 py-2 font-medium">Amount</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Accepted</th>
                        <th className="px-3 py-2 font-medium">Declaration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {importRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 font-mono text-[11px]">{row.mrn}</td>
                          <td className="px-3 py-2">{row.commodityCode}</td>
                          <td className="px-3 py-2">{row.origin}</td>
                          <td className="px-3 py-2">{row.preferenceCode}</td>
                          <td className="px-3 py-2">{row.taxType}</td>
                          <td className="px-3 py-2">
                            {row.amount != null ? `£${row.amount.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {row.customsValue != null ? `£${row.customsValue.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-3 py-2">{row.acceptanceDate}</td>
                          <td className="px-3 py-2">
                            {row.linkedDeclarationId ? (
                              <Link
                                href={`/dashboard/declarations/${row.linkedDeclarationId}`}
                                className="font-medium text-blue-600 hover:text-blue-700"
                              >
                                Open
                              </Link>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}    </div>
  );
}
