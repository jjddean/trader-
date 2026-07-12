"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
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
import { Id } from "../../../../convex/_generated/dataModel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { UnifiedComplianceTool } from "./components/UnifiedComplianceTool";
import { LandedCostCalculator } from "./components/LandedCostCalculator";
import { DocumentsTable } from "./components/DocumentsTable";
import { UploadModal } from "./components/UploadModal";
import { 
  inferDocTypeCode, 
  docTypeName, 
  normalizeDocStatus,
  DOCUMENT_TYPES,
  getHmrcRequirementSetForDeclaration,
  validateDocumentForCode,
  buildGeneratedTemplate,
} from "@/lib/utils/document-utils";
import {
  getRememberedDocumentsSnapshot,
  rememberDocumentsSnapshot,
} from "@/lib/dashboard-documents-cache";

// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DocumentsPageClientProps {
  requestedDeclarationId?: string | null;
}

export function DocumentsPageClient({ requestedDeclarationId = null }: DocumentsPageClientProps) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const userId = user?.id || "";
  const canQuery =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && Boolean(userId);

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [declarationFilter, setDeclarationFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteType, setPasteType] = useState("");
  const [pasteDeclarationId, setPasteDeclarationId] = useState("none");
  const [isPasting, setIsPasting] = useState(false);
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [isGeneratePickerOpen, setIsGeneratePickerOpen] = useState(false);
  const [generateDeclarationId, setGenerateDeclarationId] = useState("none");

  const requirementsArgs = useMemo(() => {
    if (!canQuery) return "skip" as const;
    if (declarationFilter !== "all") {
      return { declarationId: declarationFilter as Id<"declarations"> };
    }
    return {};
  }, [canQuery, declarationFilter]);

  const dbDocuments = useQuery(api.documents.getDocuments, canQuery ? { userId } : "skip");
  const requirements = useQuery(api.documents.getDocumentRequirements, requirementsArgs);
  const getDocumentDownloadUrl = useMutation(api.documents.getDocumentDownloadUrl);
  const deleteDocument = useMutation(api.documents.deleteDocument);
  const upsertRequirementsForDeclaration = useMutation(api.documents.upsertRequirementsForDeclaration);
  const allDeclarations = useQuery(
    api.declarations.getDeclarationPreviews,
    canQuery ? {} : "skip",
  );

  const remembered =
    userId && canQuery
      ? getRememberedDocumentsSnapshot(userId, declarationFilter)
      : null;
  const resolvedDbDocuments = (dbDocuments ?? remembered?.dbDocuments) as typeof dbDocuments;
  const resolvedRequirements = (requirements ?? remembered?.requirements) as typeof requirements;
  const resolvedAllDeclarations = (allDeclarations ?? remembered?.allDeclarations) as typeof allDeclarations;

  useEffect(() => {
    if (
      !userId ||
      dbDocuments === undefined ||
      requirements === undefined ||
      allDeclarations === undefined
    ) {
      return;
    }
    rememberDocumentsSnapshot({
      userId,
      declarationFilter,
      dbDocuments,
      requirements,
      allDeclarations,
    });
  }, [userId, declarationFilter, dbDocuments, requirements, allDeclarations]);

  const isDocumentsLoading =
    canQuery &&
    resolvedDbDocuments === undefined &&
    resolvedAllDeclarations === undefined;
  const declarations = resolvedAllDeclarations ?? [];
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedRequirementDeclarationsRef = useRef<Set<string>>(new Set());
  const failedRequirementHydrationRef = useRef<Set<string>>(new Set());
  const appliedQueryDeclarationRef = useRef(false);

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
  const [isDocActionLoading, setIsDocActionLoading] = useState(false);

  const runHsCodeAudit = async (extractedText: string, userCode: string) => {
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const response = await fetch('/api/ai/gir-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textractOutput: extractedText,
          declaredHsCode: userCode
        })
      });
      if (!response.ok) {
        throw new Error(`GIR audit failed: ${response.statusText}`);
      }
      const data = await response.json();
      setAuditResult(data);
    } catch (e) {
      console.error("GIR Audit Error:", e);
      setAuditResult({ error: e instanceof Error ? e.message : "Failed to run GIR audit" });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleDownloadDocument = useCallback(async () => {
    if (!selectedDocument?.id || selectedDocument.isVirtual) return;
    try {
      setIsDocActionLoading(true);
      const downloadUrl = await getDocumentDownloadUrl({ documentId: selectedDocument.id });
      if (!downloadUrl) {
        throw new Error("Failed to generate download URL.");
      }
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error?.message || "Failed to download document.");
    } finally {
      setIsDocActionLoading(false);
    }
  }, [selectedDocument, getDocumentDownloadUrl]);

  const handleRemoveDocument = useCallback(async () => {
    if (!selectedDocument?.id || selectedDocument.isVirtual) return;
    const confirmed = window.confirm("Remove this document permanently?");
    if (!confirmed) return;

    try {
      setIsDocActionLoading(true);
      await deleteDocument({ documentId: selectedDocument.id });
      setSelectedDocument(null);
    } catch (error: any) {
      alert(error?.message || "Failed to remove document.");
    } finally {
      setIsDocActionLoading(false);
    }
  }, [selectedDocument, deleteDocument]);

  const handleTriggerReplace = useCallback(() => {
    replaceFileInputRef.current?.click();
  }, []);

  const handleReplaceDocument = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !selectedDocument?.id || selectedDocument.isVirtual) return;

      try {
        setIsDocActionLoading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", selectedDocument.typeName || selectedDocument.type || "Unknown");
        formData.append("linkedDeclarationId", selectedDocument.declarationId || "none");
        formData.append("linkedMrn", selectedDocument.mrn || "none");
        formData.append("replaceDocumentId", selectedDocument.id);
        formData.append("userId", userId);

        const response = await fetch("/api/ai/smart-upload", {
          method: "POST",
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to replace document.");
        }

        setSelectedDocument((prev: any) =>
          prev
            ? {
                ...prev,
                name: file.name,
              }
            : prev,
        );
      } catch (error: any) {
        alert(error?.message || "Failed to replace document.");
      } finally {
        setIsDocActionLoading(false);
        event.target.value = "";
      }
    },
    [selectedDocument, userId],
  );

  const liveDocuments = useMemo(() => {
    return (resolvedDbDocuments || []).map((doc: any) => {
      const docTypeCode = inferDocTypeCode(doc.fileType || doc.fileName || "");
      const normalizedStatus = normalizeDocStatus(doc.status || doc.auditStatus);
      const validation = validateDocumentForCode({
        code: docTypeCode,
        fileName: doc.fileName,
        ocrText: doc.ocrText,
      });
      const finalStatus = validation.valid ? normalizedStatus : "review";
      return {
        id: doc._id,
        declarationId: doc.declarationId ? String(doc.declarationId) : "",
        name: doc.fileName || "Unknown document",
        method: "Database",
        date: new Date(doc.uploadDate || doc._creationTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
        type: docTypeCode,
        typeName: docTypeName(docTypeCode),
        mrn: doc.mrn || "Unlinked",
        status: finalStatus,
        de23: docTypeCode,
        ocrText: doc.ocrText || "",
        flag:
          !validation.valid
            ? validation.message || "Validation required"
            : normalizedStatus === "review"
              ? "Validation required"
              : normalizedStatus === "missing"
                ? "Required for declaration submission"
                : "",
        isVirtual: false,
      };
    });
  }, [resolvedDbDocuments]);

  const declarationById = useMemo(() => {
    const map = new Map<string, any>();
    for (const decl of declarations) {
      map.set(String(decl.declarationId), decl);
    }
    return map;
  }, [declarations]);

  const missingRequirementRows = useMemo(() => {
    const uploadedKeys = new Set(
      liveDocuments
        .filter((doc) => doc.declarationId && doc.type)
        .map((doc) => `${doc.declarationId}:${String(doc.type).toUpperCase()}`),
    );

    return (resolvedRequirements || [])
      .filter((req: any) => req.status !== "waived")
      .filter((req: any) => !uploadedKeys.has(`${String(req.declarationId)}:${String(req.code).toUpperCase()}`))
      .map((req: any) => {
        const decl = declarationById.get(String(req.declarationId));
        const requirementLevel = String(req.requirementLevel || "blocking");
        return {
          id: String(req._id),
          declarationId: String(req.declarationId),
          name: req.name,
          method: req.source || "Requirement Engine",
          date: new Date(req.updatedAt || req._creationTime).toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
          type: String(req.code || "UNKNOWN"),
          typeName: req.name,
          mrn: decl?.mrn || "Draft (Pending)",
          status: requirementLevel === "advisory" ? "review" : "missing",
          de23: String(req.deReference || req.code || "UNKNOWN"),
          ocrText: "",
          flag:
            requirementLevel === "advisory"
              ? req.hmrcGuidance || "Advisory evidence recommended"
              : req.hmrcGuidance || "Required for declaration submission",
          requirementLevel,
          isVirtual: true,
        };
      });
  }, [resolvedRequirements, liveDocuments, declarationById]);

  const mergedDocuments = useMemo(() => [...liveDocuments, ...missingRequirementRows], [liveDocuments, missingRequirementRows]);

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

  useEffect(() => {
    if (appliedQueryDeclarationRef.current) return;
    if (!requestedDeclarationId) {
      appliedQueryDeclarationRef.current = true;
      return;
    }
    if (allDeclarationOptions.length === 0) return;

    const hasRequestedDeclaration = allDeclarationOptions.some((opt) => opt.id === requestedDeclarationId);
    if (hasRequestedDeclaration) {
      setDeclarationFilter(requestedDeclarationId);
    }
    appliedQueryDeclarationRef.current = true;
  }, [requestedDeclarationId, allDeclarationOptions]);

  const handleManualPaste = useCallback(async () => {
    if (!pasteText.trim() || !pasteType) return;
    const linkedDeclaration = allDeclarationOptions.find((decl) => decl.id === pasteDeclarationId);

    try {
      setIsPasting(true);
      const formData = new FormData();
      formData.append("pasteText", pasteText.trim());
      formData.append("type", pasteType);
      formData.append("linkedDeclarationId", pasteDeclarationId);
      formData.append("linkedMrn", linkedDeclaration?.mrn || "none");
      formData.append("userId", userId);

      const res = await fetch("/api/ai/smart-upload", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || "Manual paste upload failed");
      }

      setIsPasteOpen(false);
      setPasteText("");
      setPasteType("");
      setPasteDeclarationId("none");
    } catch (error: any) {
      alert(error?.message || "Manual paste upload failed");
    } finally {
      setIsPasting(false);
    }
  }, [pasteText, pasteType, pasteDeclarationId, allDeclarationOptions, userId]);

  const selectedDeclaration = useMemo(() => {
    if (declarationFilter === "all") return null;
    return declarationById.get(String(declarationFilter)) || null;
  }, [declarationFilter, declarationById]);

  useEffect(() => {
    if (declarationFilter === "all") return;

    const declarationId = declarationFilter;
    if (hydratedRequirementDeclarationsRef.current.has(declarationId)) return;
    if (failedRequirementHydrationRef.current.has(declarationId)) return;

    const selected = declarationById.get(declarationId);
    if (!selected) return;

    const requiredDocs = getHmrcRequirementSetForDeclaration(selected);
    if (requiredDocs.length === 0) {
      hydratedRequirementDeclarationsRef.current.add(declarationId);
      return;
    }

    hydratedRequirementDeclarationsRef.current.add(declarationId);
    void upsertRequirementsForDeclaration({
      declarationId: declarationId as Id<"declarations">,
      requirements: requiredDocs,
    }).catch(() => {
      hydratedRequirementDeclarationsRef.current.delete(declarationId);
      failedRequirementHydrationRef.current.add(declarationId);
    });
  }, [declarationFilter, declarationById, upsertRequirementsForDeclaration]);

  const generateTemplatesForDeclaration = useCallback(async (targetDeclaration: any) => {
    if (!targetDeclaration?.declarationId) {
      return;
    }
    const requiredDocs = getHmrcRequirementSetForDeclaration(targetDeclaration);
    if (requiredDocs.length === 0) return;

    try {
      setIsGeneratingTemplates(true);
      for (const requirement of requiredDocs) {
        if (!["N935", "N271", "9100", "U166"].includes(requirement.code)) continue;
        const template = buildGeneratedTemplate({
          code: requirement.code,
          declaration: targetDeclaration,
          userName: user?.fullName || user?.firstName || "Declarant",
        });

        const formData = new FormData();
        formData.append("pasteText", template.text);
        formData.append("type", `${requirement.code} ${requirement.name}`);
        formData.append("linkedDeclarationId", String(targetDeclaration.declarationId));
        formData.append("linkedMrn", targetDeclaration.mrn || "none");
        formData.append("userId", userId);

        const res = await fetch("/api/ai/smart-upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `Failed generating ${requirement.code}`);
        }
      }
    } catch (error: any) {
      alert(error?.message || "Failed to generate templates.");
    } finally {
      setIsGeneratingTemplates(false);
    }
  }, [user, userId]);

  const handleGenerateTemplates = useCallback(async () => {
    if (selectedDeclaration?.declarationId) {
      await generateTemplatesForDeclaration(selectedDeclaration);
      return;
    }
    if (allDeclarationOptions.length === 0) {
      alert("No declarations available for template generation.");
      return;
    }
    setGenerateDeclarationId(allDeclarationOptions[0].id);
    setIsGeneratePickerOpen(true);
  }, [selectedDeclaration, allDeclarationOptions, generateTemplatesForDeclaration]);

  const handleGenerateFromPicker = useCallback(async () => {
    if (!generateDeclarationId || generateDeclarationId === "none") return;
    const target = declarationById.get(String(generateDeclarationId));
    if (!target) {
      alert("Selected declaration could not be found.");
      return;
    }
    setIsGeneratePickerOpen(false);
    await generateTemplatesForDeclaration(target);
  }, [generateDeclarationId, declarationById, generateTemplatesForDeclaration]);

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
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">
            Supporting documents required for CDS declarations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="h-9 text-[0.6875rem] font-medium tracking-normal"
            onClick={() => handleUploadOpenChange(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload document
          </Button>
          <Button
            className="h-9 text-[0.6875rem] font-medium tracking-normal bg-black text-white hover:bg-slate-800"
            onClick={() => setIsPasteOpen(true)}
          >
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Manual paste
          </Button>
        </div>
      </div>

      {/* KPI CARDS ROW */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
            Total Documents
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-foreground tabular-nums">
            {isDocumentsLoading ? "—" : stats.total}
          </h2>
          <p className="mt-1 text-[0.625rem] text-slate-500">across {stats.declCount} declarations</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
            Verified By AI
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-green-600 tabular-nums">
              {isDocumentsLoading ? "—" : stats.verified}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-slate-500">no issues found</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
            Needs Review
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-medium tracking-tight text-amber-600 tabular-nums">
              {isDocumentsLoading ? "—" : stats.review}
            </h2>
          </div>
          <p className="mt-1 text-[0.625rem] text-slate-500">compliance flags</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-slate-500 uppercase">
            Missing
          </p>
          <h2 className="text-2xl font-medium tracking-tight text-red-600 tabular-nums">
            {isDocumentsLoading ? "—" : stats.missing}
          </h2>
          <p className="mt-1 text-[0.625rem] text-slate-500">required for submission</p>
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
        onGenerateTemplates={handleGenerateTemplates}
        isGeneratingTemplates={isGeneratingTemplates}
        canGenerateTemplates={allDeclarationOptions.length > 0}
        isLoading={isDocumentsLoading}
      />
      
      <p className="text-[0.6875rem] text-slate-400 flex items-center gap-1.5 mt-3">
        <Info className="h-3.5 w-3.5" />
        DE 2/3 = CDS Data Element reference used in declaration submission
      </p>

      {/* SIDE SHEET */}
      <Sheet open={!!selectedDocument} onOpenChange={(open) => !open && handleSelectDocument(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-none w-full p-0" style={{ maxWidth: '800px' }}>
          {selectedDocument && (
            <div className="flex flex-col min-h-full">
              <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-6 sm:px-8">
                <div className="relative rounded-xl border border-slate-100/80 bg-slate-50/80 px-4 py-3 shadow-sm">
                  {!selectedDocument.isVirtual && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Replace document"
                        onClick={handleTriggerReplace}
                        disabled={isDocActionLoading}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:opacity-50"
                      >
                        <Upload className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove document"
                        onClick={handleRemoveDocument}
                        disabled={isDocActionLoading}
                        className="flex h-6 w-6 items-center justify-center rounded text-red-400 transition-colors hover:bg-white hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Download document"
                        onClick={handleDownloadDocument}
                        disabled={isDocActionLoading}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700 disabled:opacity-50"
                      >
                        <Download className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2 pr-20">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <SheetTitle className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <span className="break-all">{selectedDocument.name}</span>
                        {selectedDocument.status === "verified" && (
                          <Badge variant="secondary" className="shrink-0 rounded-md bg-green-100 text-[0.625rem] font-medium text-green-700 hover:bg-green-100">
                            Verified
                          </Badge>
                        )}
                        {selectedDocument.status === "review" && (
                          <Badge variant="secondary" className="shrink-0 rounded-md bg-amber-100 text-[0.625rem] font-medium text-amber-700 hover:bg-amber-100">
                            Review
                          </Badge>
                        )}
                        {selectedDocument.status === "missing" && (
                          <Badge variant="secondary" className="shrink-0 rounded-md bg-red-100 text-[0.625rem] font-medium text-red-700 hover:bg-red-100">
                            Missing
                          </Badge>
                        )}
                      </SheetTitle>
                      <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>{selectedDocument.typeName} ({selectedDocument.type})</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span>{selectedDocument.date}</span>
                      </SheetDescription>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="pt-6 px-6 sm:px-8 pb-12 space-y-8">
                {/* Header Summary Section */}
                <section className="bg-slate-50/80 rounded-xl p-6 border border-slate-100/80 shadow-sm">
                  <h3 className="mb-6 text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3">Document Summary</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Type</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedDocument.typeName} ({selectedDocument.type})</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Linked MRN</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950 font-mono">{selectedDocument.mrn}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">DE 2/3 Reference</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950 font-mono">{selectedDocument.de23}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Uploaded By</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedDocument.method}</p>
                    </div>
                    <div>
                      <p className="text-[0.625rem] font-semibold text-slate-500 uppercase tracking-wider">Upload Date</p>
                      <p className="mt-1.5 text-[0.8125rem] font-medium text-slate-950">{selectedDocument.date}</p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">AI Compliance Analysis</h3>
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
                <section className="border-t border-slate-100 pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">GIR HS Code Audit (Mistral-7B LoRA)</h3>
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
                    auditResult.error ? (
                      <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                        <p className="text-xs font-semibold text-red-700 mb-1">Classification Error</p>
                        <p className="text-xs text-red-600">{auditResult.error}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className={`p-4 rounded-lg border ${auditResult.complianceVerdict === 'COMPLIANT' ? 'bg-green-50 border-green-100' : auditResult.complianceVerdict === 'NON_COMPLIANT' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-[0.625rem] font-bold uppercase tracking-widest ${auditResult.complianceVerdict === 'COMPLIANT' ? 'text-green-700' : auditResult.complianceVerdict === 'NON_COMPLIANT' ? 'text-red-700' : 'text-amber-700'}`}>
                              Verdict: {auditResult.complianceVerdict}
                            </span>
                            <Badge variant="outline" className="text-[0.625rem] bg-white">
                              {(auditResult.confidence * 100).toFixed(0)}% Confidence
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">Recommended HS: <span className="font-mono">{auditResult.correctHsCode}</span></p>
                          <p className="mt-1 text-xs text-slate-700">{auditResult.verdictReasoning}</p>
                        </div>

                        {auditResult.girsApplied && Array.isArray(auditResult.girsApplied) && auditResult.girsApplied.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-500">GIR Reasoning Path</p>
                            {auditResult.girsApplied.map((gir: any, idx: number) => (
                              <div key={idx} className="pl-3 border-l-2 border-slate-200">
                                <p className="text-[0.6875rem] font-bold text-slate-900">{gir.rule}</p>
                                <p className="text-[0.6875rem] text-slate-600">{gir.analysis}</p>
                                {gir.conclusion && <p className="text-[0.6875rem] text-slate-500 italic mt-1">{gir.conclusion}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {auditResult.officerExplanation && (
                          <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                            <p className="text-[0.625rem] font-bold uppercase tracking-widest text-slate-500 mb-2">HMRC Officer Explanation</p>
                            <p className="text-xs italic text-slate-600 leading-relaxed">"{auditResult.officerExplanation}"</p>
                          </div>
                        )}
                      </div>
                    )
                  ) : !selectedDocument.ocrText ? (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xs text-slate-500 italic">Upload document via Smart-Upload to enable AI GIR Auditing.</p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xs text-slate-500 italic">Click "Run AI Audit" to analyze classification via GIR rules.</p>
                    </div>
                  )}
                </section>

                {/* Line Items Section Equivalent */}
                <section>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">Document Preview</h3>
                  <div className="overflow-hidden rounded-lg border border-slate-200 shadow-xs">
                    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
                      <FileText className="h-10 w-10 text-slate-300 mb-4" />
                      <p className="text-sm font-medium text-slate-900">Preview not available</p>
                      <p className="mt-1 text-xs text-slate-500">Document preview must be downloaded to view securely.</p>
                      <button
                        onClick={handleDownloadDocument}
                        disabled={isDocActionLoading}
                        className="mt-6 group flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 transition-colors hover:bg-slate-50 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <span className="text-xs text-slate-700 font-semibold tracking-wide">DOWNLOAD FILE</span>
                        <Download className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-600" />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <input
        ref={replaceFileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.txt"
        onChange={handleReplaceDocument}
      />


      <UploadModal 
        isOpen={isUploadOpen}
        onOpenChange={handleUploadOpenChange}
        allDeclarationOptions={allDeclarationOptions}
        userId={userId}
      />

      <UnifiedComplianceTool 
        isOpen={activeTool === 'preference'} 
        onOpenChange={(open) => !open && handleActiveToolChange(null)}
        declarationId={declarationFilter !== "all" ? declarationFilter : null}
      />

      <LandedCostCalculator 
        isOpen={activeTool === 'landed'} 
        onOpenChange={(open) => !open && handleActiveToolChange(null)} 
      />

      <Dialog open={isPasteOpen} onOpenChange={setIsPasteOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Manual paste document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Type</label>
              <Select value={pasteType} onValueChange={setPasteType}>
                <SelectTrigger className="h-9 w-full bg-slate-50 border-slate-200 text-xs text-slate-700">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] z-[110]">
                  {DOCUMENT_TYPES.map((docType) => (
                    <SelectItem key={docType.code} value={`${docType.code} ${docType.name}`} className="text-xs">
                      {docType.name} ({docType.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Link to Declaration</label>
              <Select value={pasteDeclarationId} onValueChange={setPasteDeclarationId}>
                <SelectTrigger className="h-9 w-full bg-slate-50 border-slate-200 text-xs text-slate-700">
                  <SelectValue placeholder="Select declaration" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] z-[110]">
                  <SelectItem value="none" className="text-xs">Do not link</SelectItem>
                  {allDeclarationOptions.map((decl) => (
                    <SelectItem key={decl.id} value={decl.id} className="font-mono text-xs">
                      {decl.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pasted Text</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={10}
                placeholder="Paste OCR output, invoice text, or supporting document text..."
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleManualPaste}
              disabled={isPasting || !pasteText.trim() || !pasteType}
              className="h-9 text-xs bg-black text-white hover:bg-slate-800"
            >
              {isPasting ? "Analyzing..." : "Save & Analyze"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGeneratePickerOpen} onOpenChange={setIsGeneratePickerOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Select declaration for templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Declaration</label>
            <Select value={generateDeclarationId} onValueChange={setGenerateDeclarationId}>
              <SelectTrigger className="h-9 w-full bg-slate-50 border-slate-200 text-xs text-slate-700">
                <SelectValue placeholder="Select declaration" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-[300px] z-[110]">
                {allDeclarationOptions.map((decl) => (
                  <SelectItem key={decl.id} value={decl.id} className="font-mono text-xs">
                    {decl.mrn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              onClick={handleGenerateFromPicker}
              disabled={isGeneratingTemplates || !generateDeclarationId || generateDeclarationId === "none"}
              className="h-9 text-xs bg-black text-white hover:bg-slate-800"
            >
              {isGeneratingTemplates ? "Generating..." : "Generate templates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}