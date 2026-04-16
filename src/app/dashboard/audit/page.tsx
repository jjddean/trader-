"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Upload,
  Wand2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as Select from "@radix-ui/react-select";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_AUDIT_API_URL || "http://localhost:9500";

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

export default function ComplyAuditConsole() {
  const [rawText, setRawText] = useState("");
  const [docType, setDocType] = useState("commercial_invoice");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showExtracted, setShowExtracted] = useState(true);
  const [activeTab, setActiveTab] = useState<"manual" | "upload">("manual");
  const [dragActive, setDragActive] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [selectedMrn, setSelectedMrn] = useState<string>("unlinked");

  const { user } = useUser();
  const declarations = useQuery(api.declarations.getDeclarationPreviews) || [];
  const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
  const saveDocument = useMutation(api.documents.saveDocument);

  const handleAudit = async (textToAudit?: string) => {
    const text = textToAudit || rawText;
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: text, docType }),
      });
      const data = await res.json();
      setResult(data);

    } catch (error: any) {
      setResult({
        status: "flagged",
        riskChecklist: [{
          type: "system",
          field: "connection",
          severity: "high",
          message: `Audit failed: ${error.message}`,
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
      // 1. Upload to Convex Storage Secure Vault
      setUploadStage("Uploading to Secure Vault...");
      const postUrl = await generateUploadUrl();
      const uploadResult = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await uploadResult.json();

      // 2. OCR Extraction via AWS Textract
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
      
      const { items, rawText: extractedText } = await extractRes.json();
      if (!extractedText) throw new Error("No readable text could be found by Textract.");
      
      setRawText(extractedText);

      // 3. Save to database securely linked to the Declaration
      setUploadStage("Saving metadata to database...");
      await saveDocument({
        storageId,
        userId: user?.id || "unknown",
        fileName: file.name,
        mrn: selectedMrn === "unlinked" ? undefined : selectedMrn,
        fileType: docType,
        auditStatus: "pending"
      });

      // 4. Hit compliance audit using extracted AWS Textract OCR code
      setUploadStage("Running Compliance Audit...");
      await handleAudit(extractedText);
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

  const clearAll = () => { setRawText(""); setResult(null); };
  const pasteSample = () => { setRawText(SAMPLE_TEXT); setDocType("commercial_invoice"); };

  const severityColor = (s: string) => {
    if (s === "high") return { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", icon: "text-red-500" };
    if (s === "medium") return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", icon: "text-amber-500" };
    return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", icon: "text-blue-500" };
  };

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Compliance Audit</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          Review documents for customs compliance risks before submission.
        </p>
      </div>
      
      {/* Main Container */}
      <div className="w-full space-y-6">
        <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
          
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-[#e9e9e7] bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-black">Compliance Audit</h3>
            </div>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider uppercase text-gray-600 border border-gray-200">
              BETA
            </span>
          </div>

          {/* Card Body */}
        <div className="space-y-4 p-6">
          
          {/* Tabs */}
          <div className="flex w-full rounded-md border border-gray-200 bg-gray-50 p-1 mb-6">
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 rounded py-1.5 text-xs font-medium transition-all ${
                activeTab === "manual" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Manual Paste
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 rounded py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                activeTab === "upload" ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" /> Smart Upload (AI)
            </button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 w-full">
              {/* Document Type Selector */}
              <div className="w-full flex-1">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Document Type
                </label>
                <Select.Root value={docType} onValueChange={setDocType}>
                  <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none data-[placeholder]:text-gray-400">
                    <Select.Value placeholder="Select type..." />
                    <Select.Icon>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 min-w-[16rem] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg" position="popper" sideOffset={4}>
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
                            className="relative flex cursor-pointer select-none items-center rounded-md px-8 py-2 text-xs text-gray-700 outline-none data-[highlighted]:bg-gray-50"
                          >
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                              <Check className="h-3.5 w-3.5 text-gray-500" />
                            </Select.ItemIndicator>
                            <Select.ItemText>{item.label}</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>

              {/* MRN Selector */}
              <div className="w-full flex-1">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Link to Declaration (MRN)
                </label>
                <Select.Root value={selectedMrn} onValueChange={setSelectedMrn}>
                  <Select.Trigger className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none data-[placeholder]:text-gray-400">
                    <Select.Value placeholder="Select MRN..." />
                    <Select.Icon>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="z-50 min-w-[16rem] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg" position="popper" sideOffset={4}>
                      <Select.Viewport className="p-1">
                        <Select.Item value="unlinked" className="relative flex cursor-pointer select-none items-center rounded-md px-8 py-2 text-xs text-gray-700 outline-none data-[highlighted]:bg-gray-50">
                          <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                            <Check className="h-3.5 w-3.5 text-gray-500" />
                          </Select.ItemIndicator>
                          <Select.ItemText>Do not link</Select.ItemText>
                        </Select.Item>
                        {declarations?.filter((d: any) => d.mrn).map((d: any) => (
                          <Select.Item
                            key={d.mrn}
                            value={d.mrn}
                            className="relative flex cursor-pointer select-none items-center rounded-md px-8 py-2 text-xs text-gray-700 outline-none data-[highlighted]:bg-gray-50"
                          >
                            <Select.ItemIndicator className="absolute left-2 inline-flex items-center">
                              <Check className="h-3.5 w-3.5 text-gray-500" />
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

            {/* Manual Paste Section */}
            {activeTab === "manual" && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                      Document Content
                    </label>
                    <div className="flex gap-2">
                       <button onClick={pasteSample} className="text-[0.625rem] font-medium text-gray-400 hover:text-black transition-colors uppercase tracking-wider">
                         Sample
                       </button>
                       {rawText && (
                         <button onClick={clearAll} className="text-[0.625rem] font-medium text-gray-400 hover:text-red-500 transition-colors uppercase tracking-wider">
                           Clear
                         </button>
                       )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Paste the text content of your document here for a compliance risk analysis..."
                    className="h-[280px] w-full resize-none rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>

                <div className="flex w-full">
                  <button
                    className="flex w-full h-8 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 items-center justify-center gap-2"
                    onClick={() => handleAudit()}
                    disabled={loading || !rawText.trim()}
                  >
                    {loading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running...</>
                    ) : (
                      <><Wand2 className="h-3.5 w-3.5" /> Run Compliance Audit</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Smart Upload Section */}
            {activeTab === "upload" && (
              <div className="space-y-4">
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  File Upload
                </label>
                <label
                  className={cn(
                    "block cursor-pointer rounded-xl border-2 border-dashed transition-all",
                    dragActive
                      ? "border-gray-400 bg-gray-100"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100/50"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  <div className="py-20 text-center">
                    {loading ? (
                      <div className="space-y-4">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                        <p className="text-xs font-medium text-gray-600">{uploadStage || "Processing document..."}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Upload className="mx-auto h-6 w-6 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-black">Click to upload or drag and drop</p>
                          <p className="mt-1 text-[0.625rem] text-gray-400 uppercase tracking-widest">PDF, TXT, or Image</p>
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

      {/* Results Section */}
      {result && (
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className={cn(
             "rounded-lg border p-4",
             result.status === "passed"
               ? "border-green-200 bg-green-50/50"
               : "border-red-200 bg-red-50/50"
          )}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {result.status === "passed" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-semibold",
                  result.status === "passed" ? "text-green-700" : "text-red-700"
                )}>
                  {result.status === "passed" ? "PASSED VALIDATION" : `RISKS DETECTED (${result.riskChecklist?.length || 0})`}
                </span>
              </div>
              <span className="text-[0.625rem] text-gray-400">
                ID: {Date.now().toString().slice(-6)}
              </span>
            </div>
            
            <div className="space-y-2">
              {(!result.riskChecklist || result.riskChecklist.length === 0) ? (
                <p className="text-[0.6875rem] leading-relaxed text-gray-600">No major compliance risks were found in this document structure.</p>
              ) : (
                result.riskChecklist.map((risk: any, i: number) => {
                  return (
                    <div key={i} className="flex gap-2.5 rounded-md border border-red-100 bg-white p-3">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                      <div>
                        <p className="mb-0.5 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
                          {risk.type} • {risk.field || "General"}
                        </p>
                        <p className="text-[0.6875rem] leading-relaxed text-gray-800">{risk.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {result.extractedData && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div 
                className="flex cursor-pointer items-center justify-between border-b border-gray-100 px-6 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => setShowExtracted(!showExtracted)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-black">Extracted AI Data</span>
                </div>
                {showExtracted ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </div>
              {showExtracted && (
                <div className="bg-gray-900 p-6 overflow-x-auto">
                  <pre className="text-green-400 text-[0.6875rem] font-mono leading-relaxed">
                    {JSON.stringify(result.extractedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
