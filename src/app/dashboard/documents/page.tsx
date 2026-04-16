"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { 
  Upload, 
  ClipboardPaste, 
  Info, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  Download, 
  Trash2,
  Loader2
} from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";


import { UnifiedComplianceTool } from "./components/UnifiedComplianceTool";
import { LandedCostCalculator } from "./components/LandedCostCalculator";
import { DocumentsTable } from "./components/DocumentsTable";
import { UploadModal } from "./components/UploadModal";
import { 
  inferDocTypeCode, 
  docTypeName, 
  normalizeDocStatus 
} from "@/lib/utils/document-utils";

// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DocumentsPage() {
  const { user } = useUser();
  const userId = user?.id || "";
  const dbDocuments = useQuery(api.documents.getDocuments, userId ? { userId } : "skip");
  const allDeclarations = useQuery(api.declarations.getDeclarationPreviews);
  const declarations = allDeclarations || [];
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [declarationFilter, setDeclarationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const handleActiveToolChange = useCallback((tool: string | null) => {
    setActiveTool(tool);
  }, []);

  const handleDeclarationFilterChange = useCallback((val: string) => {
    setDeclarationFilter(val);
  }, []);

  const handleTypeFilterChange = useCallback((val: string) => {
    setTypeFilter(val);
  }, []);

  const handleSelectDocument = useCallback((doc: any) => {
    setSelectedDocument(doc);
  }, []);

  const handleUploadOpenChange = useCallback((open: boolean) => {
    setIsUploadOpen(open);
  }, []);

  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  const runHsCodeAudit = async (extractedText: string, userCode: string) => {
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const response = await fetch('https://cloudagent.workers.dev/classify-gir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textractOutput: extractedText,
          declaredHsCode: userCode
        })
      });
      const data = await response.json();
      setAuditResult(data);
    } catch (e) {
      console.error("GIR Audit Error:", e);
    } finally {
      setIsAuditing(false);
    }
  };

  const liveDocuments = useMemo(() => {
    return (dbDocuments || []).map((doc: any) => {
      const docTypeCode = inferDocTypeCode(doc.fileName || "");
      const normalizedStatus = normalizeDocStatus(doc.status || doc.auditStatus);
      return {
        id: doc._id,
        declarationId: doc.declarationId ? String(doc.declarationId) : "",
        name: doc.fileName || "Unknown document",
        method: "Database",
        date: new Date(doc.uploadDate || doc._creationTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        type: docTypeCode,
        typeName: docTypeName(docTypeCode),
        mrn: doc.mrn || "Unlinked",
        status: normalizedStatus,
        de23: docTypeCode,
        ocrText: doc.ocrText || "",
        flag: normalizedStatus === "review" ? "Validation required" : normalizedStatus === "missing" ? "Required for declaration submission" : "",
      };
    });
  }, [dbDocuments]);

  const mergedDocuments = liveDocuments;

  const stats = useMemo(() => {
    const total = mergedDocuments.length;
    const verified = mergedDocuments.filter(d => d.status === 'verified').length;
    const review = mergedDocuments.filter(d => d.status === 'review').length;
    const missing = mergedDocuments.filter(d => d.status === 'missing').length;
    const declCount = new Set(mergedDocuments.map((doc) => doc.mrn).filter((mrn: string) => mrn && mrn !== "Unlinked")).size;
    
    return { total, verified, review, missing, declCount };
  }, [mergedDocuments]);

  const filteredDocuments = useMemo(() => {
    return mergedDocuments.filter((doc) => {
      const declarationMatches = declarationFilter === "all" || doc.declarationId === declarationFilter;
      const typeMatches = typeFilter === "all" || doc.typeName === typeFilter;
      return declarationMatches && typeMatches;
    });
  }, [mergedDocuments, declarationFilter, typeFilter]);

  const allDeclarationOptions = useMemo(() => {
    return declarations.map((decl: any) => ({
      id: String(decl.declarationId),
      mrn: decl.mrn ? String(decl.mrn) : "Draft (Pending)",
    }));
  }, [declarations]);

  const relevantDeclarationIds = useMemo(() => {
    return new Set(mergedDocuments.map(doc => doc.declarationId).filter(Boolean));
  }, [mergedDocuments]);

  const filteredDeclarationOptions = useMemo(() => {
    return allDeclarationOptions.filter(opt => relevantDeclarationIds.has(opt.id));
  }, [allDeclarationOptions, relevantDeclarationIds]);





  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-500">
            Supporting documents required for CDS declarations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="h-9 text-xs" onClick={() => handleUploadOpenChange(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
          <Button className="h-9 text-xs bg-black text-white hover:bg-gray-800">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Manual paste
          </Button>
        </div>
      </div>

      {/* KPI CARDS ROW */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Total Documents
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {stats.total}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">across {stats.declCount} declarations</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Verified By AI
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-green-600 tabular-nums">
              {stats.verified}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">no issues found</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Needs Review
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-amber-600 tabular-nums">
              {stats.review}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">compliance flags</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Missing
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-red-600 tabular-nums">
            {stats.missing}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">required for submission</p>
        </div>
      </div>

      {/* DOCUMENTS AREA (FILTER BAR + TABLE) */}
      <DocumentsTable 
        documents={mergedDocuments}
        declarationFilter={declarationFilter}
        onDeclarationFilterChange={handleDeclarationFilterChange}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        allDeclarationOptions={allDeclarationOptions}
        onSelectDocument={handleSelectDocument}
        onActiveToolChange={handleActiveToolChange}
      />
      
      <p className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5 mt-3">
        <Info className="h-3.5 w-3.5" />
        DE 2/3 = CDS Data Element reference used in declaration submission
      </p>

      {/* SIDE SHEET */}
      <Sheet open={!!selectedDocument} onOpenChange={(open) => !open && handleSelectDocument(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedDocument && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="px-6 sm:px-8 pt-6 pb-6 border-b border-gray-100 flex flex-row items-center justify-between shrink-0 sticky top-0 bg-white z-10">
                <div>
                  <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="truncate max-w-[300px]">{selectedDocument.name}</span>
                    {selectedDocument.status === 'verified' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 ml-2 rounded-md font-medium text-[0.625rem]">Verified</Badge>
                    )}
                    {selectedDocument.status === 'review' && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 ml-2 rounded-md font-medium text-[0.625rem]">Review</Badge>
                    )}
                    {selectedDocument.status === 'missing' && (
                      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 ml-2 rounded-md font-medium text-[0.625rem]">Missing</Badge>
                    )}
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-2 text-xs">
                    <span>{selectedDocument.typeName} ({selectedDocument.type})</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span>{selectedDocument.date}</span>
                  </SheetDescription>
                </div>
                
                {/* Minimal Action Buttons Matching Documents Page Style */}
                <div className="flex items-center gap-2 mr-8">
                  <button className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 transition-colors hover:bg-gray-100 cursor-pointer">
                    <span className="text-[0.6875rem] text-gray-700 font-medium tracking-wide">REPLACE</span>
                    <Upload className="h-3 w-3 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </button>
                  <button className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 transition-colors hover:bg-red-50 cursor-pointer">
                    <span className="text-[0.6875rem] text-red-600 font-medium tracking-wide">REMOVE</span>
                    <Trash2 className="h-3 w-3 text-red-400 transition-colors group-hover:text-red-500" />
                  </button>
                  <button className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 transition-colors hover:bg-gray-100 cursor-pointer">
                    <span className="text-[0.6875rem] text-gray-700 font-medium tracking-wide">DOWNLOAD</span>
                    <Download className="h-3 w-3 text-gray-300 transition-colors group-hover:text-gray-500" />
                  </button>
                </div>
              </SheetHeader>

              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                {/* Header Summary Section */}
                <section className="bg-gray-50/80 rounded-xl p-6 border border-gray-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3">Document Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Type</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedDocument.typeName} ({selectedDocument.type})</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Linked MRN</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950 font-mono">{selectedDocument.mrn}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">DE 2/3 Reference</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950 font-mono">{selectedDocument.de23}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Uploaded By</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedDocument.method}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-500 uppercase tracking-wider">Upload Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-gray-950">{selectedDocument.date}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">AI Compliance Analysis</h3>
                  {selectedDocument.status === 'verified' ? (
                    <div className="rounded-lg border border-green-100 bg-green-50/50 p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-green-900">No compliance issues detected</p>
                          <p className="mt-1 text-xs text-green-700 leading-relaxed">
                            Values match declaration.<br/>
                            Origin country consistent.<br/>
                            Dates valid.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : selectedDocument.status === 'review' ? (
                    <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-amber-900">Flag detected</p>
                          <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                            {selectedDocument.flag}
                          </p>
                          <Button variant="outline" size="sm" className="mt-3 text-xs bg-white text-amber-900 border-amber-200 hover:bg-amber-50">
                            View declaration
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-900">Document required but not uploaded</p>
                          <p className="mt-1 text-xs text-red-800 leading-relaxed">
                            {selectedDocument.flag}
                          </p>
                          <Button size="sm" className="mt-3 text-xs bg-red-600 hover:bg-red-700 text-white" onClick={() => { 
                            handleUploadOpenChange(true); 
                          }}>
                            Upload now
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* GIR HS Code Audit Section */}
                <section className="border-t border-gray-100 pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">GIR HS Code Audit (Mistral-7B LoRA)</h3>
                    <Button 
                      onClick={() => runHsCodeAudit(selectedDocument.ocrText, "Unknown")}
                      disabled={isAuditing || !selectedDocument.ocrText}
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7"
                    >
                      {isAuditing ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <ShieldAlert className="h-3 w-3 mr-2" />}
                      {isAuditing ? "Auditing..." : "Run AI Audit"}
                    </Button>
                  </div>
                  
                  {auditResult ? (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg border ${auditResult.complianceVerdict === 'COMPLIANT' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[0.625rem] font-bold uppercase tracking-widest ${auditResult.complianceVerdict === 'COMPLIANT' ? 'text-green-700' : 'text-red-700'}`}>
                            Verdict: {auditResult.complianceVerdict}
                          </span>
                          <Badge variant="outline" className="text-[0.625rem] bg-white">
                            {(auditResult.confidence * 100).toFixed(0)}% Confidence
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">Recommended HS: <span className="font-mono">{auditResult.correctHsCode}</span></p>
                        <p className="mt-1 text-xs text-gray-700">{auditResult.verdictReasoning}</p>
                      </div>

                      <div className="space-y-3">
                        <p className="text-[0.625rem] font-bold uppercase tracking-widest text-gray-500">GIR Reasoning Path</p>
                        {auditResult.girsApplied.map((gir: any, idx: number) => (
                          <div key={idx} className="pl-3 border-l-2 border-gray-200">
                            <p className="text-[0.6875rem] font-bold text-gray-900">{gir.rule}</p>
                            <p className="text-[0.6875rem] text-gray-600">{gir.analysis}</p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                        <p className="text-[0.625rem] font-bold uppercase tracking-widest text-gray-500 mb-2">HMRC Officer Explanation</p>
                        <p className="text-xs italic text-gray-600 leading-relaxed">"{auditResult.officerExplanation}"</p>
                      </div>
                    </div>
                  ) : !selectedDocument.ocrText ? (
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500 italic">Upload document via Smart-Upload to enable AI GIR Auditing.</p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-gray-50 border border-gray-100 text-center">
                      <p className="text-xs text-gray-500 italic">Click "Run AI Audit" to analyze classification via GIR rules.</p>
                    </div>
                  )}
                </section>

                {/* Line Items Section Equivalent */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-gray-900 border-b border-gray-100 pb-3">Document Preview</h3>
                  <div className="overflow-hidden rounded-lg border border-gray-200 shadow-xs">
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50/50">
                      <FileText className="h-10 w-10 text-gray-300 mb-4" />
                      <p className="text-sm font-medium text-gray-900">Preview not available</p>
                      <p className="mt-1 text-xs text-gray-500">Document preview must be downloaded to view securely.</p>
                      <button className="mt-6 group flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 transition-colors hover:bg-gray-50 cursor-pointer shadow-sm">
                        <span className="text-xs text-gray-700 font-semibold tracking-wide">DOWNLOAD FILE</span>
                        <Download className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-gray-600" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>


      <UploadModal 
        isOpen={isUploadOpen}
        onOpenChange={handleUploadOpenChange}
        allDeclarationOptions={allDeclarationOptions}
        userId={userId}
      />

      <UnifiedComplianceTool 
        isOpen={activeTool === 'preference' || activeTool === 'roo'} 
        onOpenChange={(open) => !open && handleActiveToolChange(null)} 
      />

      <LandedCostCalculator 
        isOpen={activeTool === 'landed'} 
        onOpenChange={(open) => !open && handleActiveToolChange(null)} 
      />

    </div>
  );
}
