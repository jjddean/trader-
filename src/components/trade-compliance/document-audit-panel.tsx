"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  Loader2,
  Upload,
  Wand2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";
import * as Select from "@radix-ui/react-select";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "../../../convex/_generated/dataModel";

const SAMPLE_TEXT = `COMMERCIAL INVOICE
Invoice No: CI-2024-001
Date: 2024-02-22
Shipper: Global Tech Solutions Ltd, 123 Industrial Rd, Shenzhen, China
Consignee: UK Logistics Hub, Gateway Park, London, United Kingdom

Description of Goods: Assorted Electronic Parts
HS Code: 85
Quantity: 500 PCS
Unit Price: 10.00 USD
Total Value: 5,000.00 USD
Incoterms: EXW
Weight: 120 KG`;

interface DocumentAuditPanelProps {
  assessmentId?: Id<"export_assessments">;
}

export function DocumentAuditPanel({ assessmentId }: DocumentAuditPanelProps) {
  const [rawText, setRawText] = useState("");
  const [docType, setDocType] = useState("commercial_invoice");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [inputTab, setInputTab] = useState<"manual" | "upload">("upload");
  const [dragActive, setDragActive] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [selectedMrn, setSelectedMrn] = useState<string>("unlinked");

  const { user, isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const canQuery =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const declarations = useQuery(api.declarations.getDeclarationPreviews, canQuery ? {} : "skip") || [];
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.saveDocument);

  const handleAudit = async (textToAudit?: string, documentId?: string) => {
    const text = textToAudit || rawText;
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/export-controls/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText: text,
          docType,
          documentId,
          runExtraction: true,
          assessmentId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Audit failed (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Audit failed";
      setResult({
        status: "flagged",
        riskChecklist: [{
          type: "system",
          field: "connection",
          severity: "high",
          message: `Audit failed: ${message}`,
        }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setUploadStage("Preparing Document Vault...");
    try {
      setUploadStage("Uploading to Secure Vault...");
      const postUrl = await generateUploadUrl();
      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await uploadResult.json();

      setUploadStage("Extracting text via AWS Textract OCR...");
      const formData = new FormData();
      formData.append("file", file);

      const extractRes = await fetch("/api/ai/extract", {
        method: "POST",
        body: formData,
      });

      if (!extractRes.ok) {
        throw new Error("AWS Textract failed to extract text from this document. Please check the file validity.");
      }

      const { rawText: extractedText } = await extractRes.json();
      if (!extractedText) throw new Error("No readable text could be found by Textract.");

      setRawText(extractedText);

      setUploadStage("Saving metadata to database...");
      const documentId = await saveDocument({
        storageId,
        userId: user?.id || "unknown",
        fileName: file.name,
        mrn: selectedMrn === "unlinked" ? undefined : selectedMrn,
        fileType: docType,
        auditStatus: "pending",
        ocrText: extractedText,
      });

      setUploadStage("Running Compliance Audit...");
      await handleAudit(extractedText, documentId);
    } catch (error: any) {
      setResult({
        status: "flagged",
        riskChecklist: [{
          type: "system",
          field: "upload",
          severity: "high",
          message: error.message,
        }],
      });
    } finally {
      setLoading(false);
      setUploadStage("");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clearAll = () => {
    setRawText("");
    setResult(null);
  };

  const pasteSample = () => {
    setRawText(SAMPLE_TEXT);
    setDocType("commercial_invoice");
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-medium text-black">Document Audit</h3>
          </div>
          <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider text-slate-600 uppercase">
            BETA
          </span>
        </div>

        <div className="space-y-4 p-6">
          <div className="mb-6 flex w-full rounded-md border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setInputTab("upload")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded py-1.5 text-xs font-medium transition-all",
                inputTab === "upload" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Wand2 className="h-3.5 w-3.5" /> Smart Upload (AI)
            </button>
            <button
              type="button"
              onClick={() => setInputTab("manual")}
              className={cn(
                "flex-1 rounded py-1.5 text-xs font-medium transition-all",
                inputTab === "manual" ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              Manual Paste
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid w-full grid-cols-2 gap-4">
              <div className="w-full flex-1">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                  Document Type
                </label>
                <Select.Root value={docType} onValueChange={setDocType}>
                  <Select.Trigger className={ENTERPRISE_SELECT_TRIGGER}>
                    <Select.Value placeholder="Select type..." />
                    <Select.Icon>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className={cn(ENTERPRISE_SELECT_CONTENT, "z-50")} position="popper" sideOffset={4}>
                      <Select.Viewport className="p-1">
                        {[
                          { value: "auto", label: "Auto-detect Type" },
                          { value: "commercial_invoice", label: "Commercial Invoice" },
                          { value: "packing_list", label: "Packing List" },
                          { value: "bol", label: "Bill of Lading" },
                          { value: "air_waybill", label: "Air Waybill" },
                          { value: "certificate_of_origin", label: "Certificate of Origin" },
                        ].map((item) => (
                          <Select.Item
                            key={item.value}
                            value={item.value}
                            className={cn(ENTERPRISE_SELECT_ITEM, "relative flex select-none items-center px-8 outline-none")}
                          >
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                              <Check className="h-3.5 w-3.5 text-slate-500" />
                            </Select.ItemIndicator>
                            <Select.ItemText>{item.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              <div className="w-full flex-1">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                  Link to Declaration (MRN)
                </label>
                <Select.Root value={selectedMrn} onValueChange={setSelectedMrn}>
                  <Select.Trigger className={ENTERPRISE_SELECT_TRIGGER}>
                    <Select.Value placeholder="Select MRN..." />
                    <Select.Icon>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className={cn(ENTERPRISE_SELECT_CONTENT, "z-50")} position="popper" sideOffset={4}>
                      <Select.Viewport className="p-1">
                        <Select.Item value="unlinked" className={cn(ENTERPRISE_SELECT_ITEM, "relative flex select-none items-center px-8 outline-none")}>
                          <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                            <Check className="h-3.5 w-3.5 text-slate-500" />
                          </Select.ItemIndicator>
                          <Select.ItemText>Do not link</Select.ItemText>
                        </Select.Item>
                        {declarations?.filter((d: any) => d.mrn).map((d: any) => (
                          <Select.Item
                            key={d.mrn}
                            value={d.mrn}
                            className={cn(ENTERPRISE_SELECT_ITEM, "relative flex select-none items-center px-8 outline-none")}
                          >
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                              <Check className="h-3.5 w-3.5 text-slate-500" />
                            </Select.ItemIndicator>
                            <Select.ItemText>{d.mrn}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>

            {inputTab === "manual" && (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                      Document Content
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={pasteSample}
                        className="text-[0.625rem] font-medium tracking-wider text-slate-400 uppercase transition-colors hover:text-black"
                      >
                        Sample
                      </button>
                      {rawText && (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="text-[0.625rem] font-medium tracking-wider text-slate-400 uppercase transition-colors hover:text-red-500"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Paste the text content of your document here for a compliance risk analysis..."
                    className="h-[280px] w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>

                <div className="flex w-full">
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => handleAudit()}
                    disabled={loading || !rawText.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" /> Run Compliance Audit
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {inputTab === "upload" && (
              <div className="space-y-4">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                  File Upload
                </label>
                <label
                  className={cn(
                    "block cursor-pointer rounded-xl border-2 border-dashed transition-all",
                    dragActive
                      ? "border-slate-400 bg-slate-100"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100/50",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="py-20 text-center">
                    {loading ? (
                      <div className="space-y-4">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
                        <p className="text-xs font-medium text-slate-600">{uploadStage || "Processing document..."}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="mx-auto h-6 w-6 text-slate-400" />
                        <div>
                          <p className="text-sm font-medium text-black">Click to upload or drag and drop</p>
                          <p className="mt-1 text-[0.625rem] tracking-widest text-slate-400 uppercase">PDF, TXT, or Image</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.txt,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 w-full space-y-4 duration-500">
          <div
            className={cn(
              "rounded-lg border p-4",
              result.status === "passed"
                ? "border-green-200 bg-green-50/50"
                : "border-red-200 bg-red-50/50",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.status === "passed" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    result.status === "passed" ? "text-green-700" : "text-red-700",
                  )}
                >
                  {result.status === "passed" ? "PASSED VALIDATION" : `RISKS DETECTED (${result.riskChecklist?.length || 0})`}
                </span>
              </div>
              <span className="text-[0.625rem] text-slate-400">
                ID: {Date.now().toString().slice(-6)}
              </span>
            </div>

            <div className="space-y-2">
              {!result.riskChecklist || result.riskChecklist.length === 0 ? (
                <p className="text-[0.6875rem] leading-relaxed text-slate-600">
                  No major compliance risks were found in this document structure.
                </p>
              ) : (
                result.riskChecklist.map((risk: any, i: number) => (
                  <div key={i} className="flex gap-2.5 rounded-md border border-red-100 bg-white p-3">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                    <div>
                      <p className="mb-0.5 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
                        {risk.type} • {risk.field || "General"}
                      </p>
                      <p className="text-[0.6875rem] leading-relaxed text-slate-800">{risk.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {result.extractedData && (
            <details className="mt-2 cursor-pointer rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-500">
              <summary className="font-mono text-[10px] font-semibold hover:text-slate-900">
                View Extracted AI Data
              </summary>
              <pre className="mt-2 max-h-96 overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[10px] whitespace-pre-wrap text-green-400">
                {JSON.stringify(result.extractedData, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
