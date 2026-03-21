"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Upload, ClipboardPaste, Info, FileText, CheckCircle2, ShieldAlert, Download, Loader2, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function DocumentsPage() {
  const { user } = useUser();
  const userId = user?.id || "";
  const dbDocuments = useQuery(api.documents.getDocuments, userId ? { userId } : "skip");
  const allDeclarations = useQuery(api.declarations.getAllDecls);
  const userDeclarations = (allDeclarations || []).filter((decl: any) => decl.userId === userId);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState(1);
  const [uploadForm, setUploadForm] = useState({ type: "", linkedMrn: "", file: null as any });
  const [isUploading, setIsUploading] = useState(false);
  const [declarationFilter, setDeclarationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const liveDocuments = (dbDocuments || []).map((doc: any) => {
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
      flag: normalizedStatus === "review" ? "Validation required" : normalizedStatus === "missing" ? "Required for declaration submission" : "",
    };
  });
  const mergedDocuments = [...documents, ...liveDocuments];
  const declarationCount = new Set(mergedDocuments.map((doc) => doc.mrn).filter((mrn: string) => mrn && mrn !== "Unlinked")).size;
  const totalDocs = mergedDocuments.length;
  const verifiedDocs = mergedDocuments.filter(d => d.status === 'verified').length;
  const reviewDocs = mergedDocuments.filter(d => d.status === 'review').length;
  const missingDocs = mergedDocuments.filter(d => d.status === 'missing').length;
  const filteredDocuments = mergedDocuments.filter((doc) => {
    const declarationMatches = declarationFilter === "all" || doc.declarationId === declarationFilter;
    const typeMatches = typeFilter === "all" || doc.typeName === typeFilter;
    return declarationMatches && typeMatches;
  });
  const declarationOptions = userDeclarations.map((decl: any) => ({
    id: String(decl._id),
    mrn: decl.mrn ? String(decl.mrn) : "— pending",
  }));
  const declarationById = Object.fromEntries(declarationOptions.map((decl) => [decl.id, decl]));
  const typeOptions = Array.from(new Set(mergedDocuments.map((doc) => doc.typeName).filter(Boolean)));

  const handleUploadSubmit = () => {
    setIsUploading(true);
    // Simulate AI Smart Upload logic
    setTimeout(() => {
      const isMissing = uploadForm.type.includes("C400"); // hardcode error mock mechanism
      const newDoc = {
        id: Date.now(),
        declarationId: uploadForm.linkedMrn === "none" ? "" : uploadForm.linkedMrn,
        name: uploadForm.file?.name || "New Document.pdf",
        method: "Smart Upload",
        date: "Just now",
        type: uploadForm.type.split(' ')[0] || "N935",
        typeName: uploadForm.type.split(' ').slice(1).join(' ') || "Commercial invoice",
        mrn: uploadForm.linkedMrn === "none" ? "Unlinked" : (declarationById[uploadForm.linkedMrn]?.mrn || uploadForm.linkedMrn),
        status: isMissing ? "review" : "verified",
        de23: uploadForm.type.split(' ')[0] || "N935",
        flag: isMissing ? "Verification failed on import reference matching" : ""
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setIsUploading(false);
      setIsUploadOpen(false);
      setUploadStep(1);
      setUploadForm({ type: "", linkedMrn: "", file: null });
    }, 2000);
  };

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
          <Button variant="outline" className="h-9 text-xs">
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Manual paste
          </Button>
          <Button className="h-9 text-xs" onClick={() => setIsUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload document
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
            {totalDocs}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">across {declarationCount} declarations</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Verified By AI
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-green-600 tabular-nums">
              {verifiedDocs}
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
              {reviewDocs}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-500">compliance flags</p>
        </div>

        <div className="rounded-xl border border-[#e9e9e7] bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-500 uppercase">
            Missing
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-red-600 tabular-nums">
            {missingDocs}
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-500">required for submission</p>
        </div>
      </div>

      {/* FILTER BAR & TABLE AREA */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
        <div className="flex items-center gap-3 border-b border-[#e9e9e7] bg-gray-50 px-5 py-4">
          <Select value={declarationFilter} onValueChange={setDeclarationFilter}>
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All declarations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All declarations</SelectItem>
              {declarationOptions.map((decl) => (
                <SelectItem key={decl.id} value={decl.id} className="text-xs font-mono">{decl.mrn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px] h-8 bg-white text-xs border-gray-200">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All types</SelectItem>
              {typeOptions.map((typeName) => (
                <SelectItem key={typeName} value={typeName} className="text-xs">{typeName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-[#e9e9e7]">
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase w-[40%]">DOCUMENT</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">TYPE</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">LINKED MRN</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">STATUS</th>
                <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right w-[80px]">DE 2/3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e9e7]">
              {filteredDocuments.map((doc) => {
                const isWarning = doc.status === 'review';
                const isMissing = doc.status === 'missing';

                return (
                  <tr 
                    key={doc.id}
                    onClick={() => setSelectedDocument(doc)} 
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isWarning ? "bg-amber-50/50 hover:bg-amber-50" : "",
                      isMissing ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-semibold transition-colors", isWarning ? "text-amber-900 group-hover:text-amber-900" : isMissing ? "text-red-900 group-hover:text-red-900" : "text-black group-hover:text-black")}>
                          {doc.name}
                        </span>
                        <span className={cn("text-[0.625rem] mt-0.5", isWarning ? "text-amber-700 font-medium" : isMissing ? "text-red-700 font-medium" : "text-gray-500")}>
                          {isMissing || isWarning ? doc.flag : `${doc.method} • ${doc.date}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-gray-600">
                      {doc.typeName} <span className="text-[0.625rem] text-gray-400 ml-1">({doc.type})</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold text-black transition-colors group-hover:text-black">{doc.mrn}</span>
                    </td>
                    <td className="px-6 py-4">
                      {doc.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                          Verified
                        </span>
                      )}
                      {doc.status === 'review' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700">
                          Review
                        </span>
                      )}
                      {doc.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[0.6875rem] font-medium text-gray-400">{doc.de23}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <p className="text-[0.6875rem] text-gray-400 flex items-center gap-1.5 mt-3">
        <Info className="h-3.5 w-3.5" />
        DE 2/3 = CDS Data Element reference used in declaration submission
      </p>

      {/* SIDE SHEET */}
      <Sheet open={!!selectedDocument} onOpenChange={(open) => !open && setSelectedDocument(null)}>
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
                <section>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">Document Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Type</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedDocument.typeName} ({selectedDocument.type})</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Linked MRN</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900 font-mono">{selectedDocument.mrn}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">DE 2/3 Reference</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900 font-mono">{selectedDocument.de23}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Uploaded By</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedDocument.method}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Upload Date</p>
                      <p className="mt-1 text-[0.8125rem] font-medium text-gray-900">{selectedDocument.date}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">AI Compliance Analysis</h3>
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
                            const typeMap: Record<string, string> = {
                              "N935": "N935 Commercial invoice",
                              "N271": "N271 Packing list",
                              "N864": "N864 Certificate of origin",
                              "N703": "N703 Bill of lading",
                              "C400": "C400 Import licence"
                            };
                            const mappedType = typeMap[selectedDocument.type] || "ZZZ Other";
                            setUploadForm({ type: mappedType, linkedMrn: selectedDocument.declarationId || "none", file: null as any });
                            setUploadStep(1);
                            setSelectedDocument(null); 
                            setIsUploadOpen(true); 
                          }}>
                            Upload now
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Line Items Section Equivalent */}
                <section>
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-100 pb-2">Document Preview</h3>
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

      {/* UPLOAD MODAL */}
      <Dialog open={isUploadOpen} onOpenChange={(open) => !open && setIsUploadOpen(false)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>

          {uploadStep === 1 && (
            <div>
              <div className="grid gap-4 py-4">
                <div>
                  <label htmlFor="docType" className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Document Type
                  </label>
                  <Select value={uploadForm.type} onValueChange={(val) => setUploadForm({...uploadForm, type: val})}>
                    <SelectTrigger id="docType" className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px]">
                      <SelectItem value="N935 Commercial invoice" className="text-xs">Commercial invoice (N935)</SelectItem>
                      <SelectItem value="N271 Packing list" className="text-xs">Packing list (N271)</SelectItem>
                      <SelectItem value="N864 Certificate of origin" className="text-xs">Certificate of origin (N864)</SelectItem>
                      <SelectItem value="N703 Bill of lading" className="text-xs">Bill of lading (N703)</SelectItem>
                      <SelectItem value="C400 Import licence" className="text-xs">Import licence (C400)</SelectItem>
                      <SelectItem value="ZZZ Other" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="docLink" className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Link to Declaration
                  </label>
                  <Select value={uploadForm.linkedMrn} onValueChange={(val) => setUploadForm({...uploadForm, linkedMrn: val})}>
                    <SelectTrigger id="docLink" className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700">
                      <SelectValue placeholder="Select declaration" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px]">
                      {declarationOptions.map((decl) => (
                        <SelectItem key={decl.id} value={decl.id} className="text-xs font-mono">{decl.mrn}</SelectItem>
                      ))}
                      <SelectItem value="none" className="text-xs">Do not link</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <button
                  disabled={!uploadForm.type || !uploadForm.linkedMrn}
                  onClick={() => setUploadStep(2)}
                  className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
                >
                  Continue
                </button>
              </DialogFooter>
            </div>
          )}

          {uploadStep === 2 && (
            <div>
              <div className="grid gap-4 py-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-gray-50/50">
                  <Upload className="h-8 w-8 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-900">Drag and drop document here</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">Accepted: PDF, JPG, PNG</p>
                  
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadForm({...uploadForm, file: e.target.files[0]});
                      }
                    }}
                  />
                  <button onClick={() => document.getElementById('file-upload')?.click()} className="flex h-9 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                    Browse files
                  </button>
                </div>
                
                {uploadForm.file && (
                  <div className="flex items-center justify-between p-3 border border-gray-200 rounded-md bg-white">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-medium text-gray-700 truncate">{uploadForm.file.name}</span>
                    </div>
                    <span className="text-[0.625rem] text-gray-400 shrink-0 ml-2">
                      {(uploadForm.file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <button
                  disabled={!uploadForm.file || isUploading}
                  onClick={handleUploadSubmit}
                  className="flex h-9 w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
                >
                  {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isUploading ? "Analyzing..." : "Upload & Analyze"}
                </button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/*
        ========================================================================
        LEGACY TOOLS PRESERVATION
        The DCTS Eligibility Check, Rules of Origin Simulator, and Landed Cost 
        Calculator have been successfully archived here. DO NOT DELETE.
        They will be migrated to /dashboard/tools in a future task.
        ========================================================================

        [LEGACY IMPORTS]
        import { useQuery, useMutation } from "convex/react";
        import { api } from "../../../../convex/_generated/api";
        import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, FileText, Download, Globe, Package, Calculator } from "lucide-react";

        [LEGACY STATE]
        const [selectedCountry, setSelectedCountry] = useState("");
        const eligibility = useQuery(api.compliance.checkEligibility, selectedCountry ? { originCountry: selectedCountry } : "skip");
        
        const simulateRoO = useMutation(api.compliance.simulateRoO);
        const [rooForm, setRooForm] = useState({ originCountry: "", commodityCode: "", valueOrigin: "", valueUK: "", valueThirdParty: "" });
        const [rooResult, setRooResult] = useState<any | null>(null);
        const [simulating, setSimulating] = useState(false);

        const calculateLandedCost = useMutation(api.calculator.calculateLandedCost);
        const [calcForm, setCalcForm] = useState({ hsCode: "", originCountry: "", itemValue: "", shippingCost: "", dutyRate: "", vatRate: "20" });
        const [calcResult, setCalcResult] = useState<any | null>(null);
        const [calculating, setCalculating] = useState(false);

        [LEGACY JSX - DCTS Eligibility Check & Rules of Origin Simulator]
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          // Left: DCTS Eligibility Checker
          <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
            ...
          </div>
          
          // Right: Rules of Origin Simulator
          <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
            ...
          </div>
        </div>

        [LEGACY JSX - Landed Cost Calculator]
        <div className="overflow-hidden rounded-xl border border-[#e9e9e7] bg-white">
          ...
        </div>
      */}

    </div>
  );
}

function inferDocTypeCode(fileName: string) {
  const upperName = fileName.toUpperCase();
  if (upperName.includes("INVOICE") || upperName.startsWith("INV")) return "N935";
  if (upperName.includes("PACK") || upperName.startsWith("PL-")) return "N271";
  if (upperName.includes("ORIGIN") || upperName.includes("CERT")) return "N864";
  if (upperName.includes("BOL") || upperName.includes("LADING")) return "N703";
  if (upperName.includes("LIC")) return "C400";
  return "ZZZ";
}

function docTypeName(code: string) {
  const map: Record<string, string> = {
    N935: "Commercial invoice",
    N271: "Packing list",
    N864: "Certificate of origin",
    N703: "Bill of lading",
    C400: "Licence",
    ZZZ: "Other",
  };
  return map[code] || "Other";
}

function normalizeDocStatus(status: string) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("clean") || normalized.includes("verified") || normalized.includes("accepted")) return "verified";
  if (normalized.includes("missing")) return "missing";
  if (normalized.includes("review") || normalized.includes("flag") || normalized.includes("pending")) return "review";
  return "review";
}
