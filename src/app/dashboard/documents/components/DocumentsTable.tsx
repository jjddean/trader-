"use client";

import React, { useMemo } from "react";
import { ChevronDown, FilePlus2, FileText, ListChecks, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DOCUMENT_TYPES } from "@/lib/utils/document-utils";
import {
  ENTERPRISE_DROPDOWN_ITEM,
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
} from "@/lib/enterprise-select-styles";

const FILTER_CONTROL_CLASS =
  "group flex h-9 min-w-0 flex-1 shrink items-center justify-between gap-2 whitespace-nowrap rounded-md border-0 bg-transparent px-3 py-2 text-xs font-medium text-slate-500 shadow-none transition-all outline-none hover:bg-white hover:text-black hover:shadow-sm focus:bg-white focus:text-black focus:shadow-sm focus:outline-none focus-visible:ring-0 data-[state=open]:bg-white data-[state=open]:text-black data-[state=open]:shadow-sm data-[placeholder]:text-slate-500";

const FILTER_ICON_CLASS =
  "size-3.5 shrink-0 text-slate-400 group-hover:text-blue-600 group-focus:text-blue-600 group-data-[state=open]:text-blue-600";

interface DocumentTableRow {
  id: string;
  declarationId: string;
  name: string;
  method: string;
  date: string;
  type: string;
  typeName: string;
  mrn: string;
  status: string;
  de23: string;
  flag?: string;
  requirementLevel?: string;
  isVirtual: boolean;
  ocrText?: string;
}

interface DeclarationOption {
  id: string;
  mrn: string;
}
interface DocumentsTableProps {
  documents: DocumentTableRow[];
  declarationFilter: string;
  onDeclarationFilterChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  allDeclarationOptions: DeclarationOption[];
  onSelectDocument: (doc: DocumentTableRow) => void;
  onActiveToolChange: (tool: string) => void;
  onGenerateTemplates: () => void;
  isGeneratingTemplates: boolean;
  canGenerateTemplates: boolean;
  isLoading?: boolean;
}

export const DocumentsTable = React.memo(function DocumentsTable({
  documents,
  declarationFilter,
  onDeclarationFilterChange,
  typeFilter,
  onTypeFilterChange,
  allDeclarationOptions,
  onSelectDocument,
  onActiveToolChange,
  onGenerateTemplates,
  isGeneratingTemplates,
  canGenerateTemplates,
  isLoading = false,
}: DocumentsTableProps) {

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const declarationMatches = declarationFilter === "all" || doc.declarationId === declarationFilter;
      const typeMatches = typeFilter === "all" || doc.typeName === typeFilter;
      return declarationMatches && typeMatches;
    });
  }, [documents, declarationFilter, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex w-full gap-1 overflow-hidden rounded-lg bg-slate-100/80 p-1">
          <div className="contents">
              <Select value={declarationFilter} onValueChange={onDeclarationFilterChange}>
                <SelectTrigger className={FILTER_CONTROL_CLASS}>
                  <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <FileText className={FILTER_ICON_CLASS} />
                    <SelectValue placeholder="All declarations" className="min-w-0 flex-1 truncate text-left" />
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                  <SelectItem value="all" className={ENTERPRISE_SELECT_ITEM}>All declarations</SelectItem>
                  {allDeclarationOptions.map((decl) => (
                    <SelectItem key={decl.id} value={decl.id} className={ENTERPRISE_SELECT_ITEM}>
                      {decl.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className={FILTER_CONTROL_CLASS}>
                  <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <ListChecks className={FILTER_ICON_CLASS} />
                    <SelectValue placeholder="All types" className="min-w-0 flex-1 truncate text-left" />
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
                  <SelectItem value="all" className={ENTERPRISE_SELECT_ITEM}>All types</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.code} value={type.name} className={ENTERPRISE_SELECT_ITEM}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger className={FILTER_CONTROL_CLASS}>
                  <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <ShieldCheck className={FILTER_ICON_CLASS} />
                    <span className="truncate">Compliance Tools</span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </DropdownMenuTrigger>

                <DropdownMenuContent className="z-[100] min-w-[16rem] overflow-hidden rounded-lg border border-slate-100 bg-white p-1 shadow-lg" align="end">
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("preference")}
                    className={ENTERPRISE_DROPDOWN_ITEM}
                  >
                    Preference Checker
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("landed")}
                    className={ENTERPRISE_DROPDOWN_ITEM}
                  >
                    Landed Cost Calculator
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          <Button
            variant="ghost"
            className={cn(FILTER_CONTROL_CLASS, "justify-center")}
            onClick={onGenerateTemplates}
            disabled={isGeneratingTemplates || !canGenerateTemplates}
          >
            <FilePlus2 className="size-3.5 text-slate-400 group-focus:text-blue-600" />
            <span className="truncate">
              {isGeneratingTemplates ? "Generating..." : "Generate templates"}
            </span>
          </Button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-white">
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase w-[40%]">DOCUMENT</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">TYPE</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">LINKED MRN</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">STATUS</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase text-right w-[80px]">DE 2/3</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                  Loading documents…
                </td>
              </tr>
            ) : filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center py-6 text-center">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <FileText className="h-4 w-4 text-slate-300" />
                    </div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {documents.length === 0 ? "No documents yet" : "No matching documents"}
                    </h4>
                    <p className="mt-1 max-w-sm text-xs text-slate-500">
                      {documents.length === 0
                        ? "Uploaded and generated documents will appear here."
                        : "No documents match the selected filters. Try changing your filter options."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => {
                const isWarning = doc.status === 'review';
                const isMissing = doc.status === 'missing';

                return (
                  <tr 
                    key={doc.id}
                    onClick={() => onSelectDocument(doc)} 
                    className={cn(
                      "group cursor-pointer transition-colors",
                      isWarning ? "bg-amber-50/50 hover:bg-amber-50" : "",
                      isMissing ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={cn("text-xs font-semibold transition-colors", isWarning ? "text-amber-900 group-hover:text-amber-900" : isMissing ? "text-red-900 group-hover:text-red-900" : "text-black group-hover:text-black")}>
                          {doc.name}
                        </span>
                        <span className={cn("text-[0.625rem] mt-0.5", isWarning ? "text-amber-700 font-medium" : isMissing ? "text-red-700 font-medium" : "text-slate-500")}>
                          {isMissing || isWarning ? doc.flag : `${doc.method} • ${doc.date}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {doc.typeName} <span className="text-[0.625rem] text-slate-400 ml-1">({doc.type})</span>
                    </td>
                    <td className="px-6 py-4">
                      {doc.mrn === "Unlinked" || doc.mrn === "Draft (Pending)" ? (
                        <span className="text-[0.6875rem] text-slate-400">—</span>
                      ) : (
                        <span className="text-xs font-semibold text-black">{doc.mrn}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {doc.status === 'verified' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                          Verified
                        </span>
                      )}
                      {doc.status === 'review' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[0.625rem] font-medium text-amber-700">
                          {doc.requirementLevel === "advisory" ? "Advisory" : "Review"}
                        </span>
                      )}
                      {doc.status === 'missing' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[0.625rem] font-medium text-red-700">
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-[0.6875rem] font-medium text-slate-400">{doc.de23}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
