"use client";

import React, { useMemo } from "react";
import { 
  ChevronDown
} from "lucide-react";
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
import { ClientOnly } from "@/components/client-only";
import { DOCUMENT_TYPES } from "@/lib/utils/document-utils";

const FILTER_CONTROL_CLASS =
  "h-9 w-full border-slate-200 bg-white text-[0.6875rem] font-medium tracking-normal text-slate-600 shadow-sm";

const FILTER_MENU_ITEM_CLASS =
  "text-[0.6875rem] font-medium tracking-normal text-slate-600 focus:bg-slate-50 focus:text-slate-700 data-[highlighted]:bg-slate-50 data-[highlighted]:text-slate-700 py-2 [&_[data-slot=select-item-indicator]_svg]:size-3";

const FILTER_SELECT_CONTENT_CLASS = "z-[100] max-h-[300px] min-w-[var(--radix-select-trigger-width)]";

interface DocumentsTableProps {
  documents: any[];
  declarationFilter: string;
  onDeclarationFilterChange: (val: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  allDeclarationOptions: any[];
  onSelectDocument: (doc: any) => void;
  onActiveToolChange: (tool: string) => void;
  onGenerateTemplates: () => void;
  isGeneratingTemplates: boolean;
  canGenerateTemplates: boolean;
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
}: DocumentsTableProps) {

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const declarationMatches = declarationFilter === "all" || doc.declarationId === declarationFilter;
      const typeMatches = typeFilter === "all" || doc.typeName === typeFilter;
      return declarationMatches && typeMatches;
    });
  }, [documents, declarationFilter, typeFilter]);

  const filterSkeleton = (
    <>
      <div className="h-9 w-full animate-pulse rounded-md border border-slate-200 bg-slate-100" />
      <div className="h-9 w-full animate-pulse rounded-md border border-slate-200 bg-slate-100" />
      <div className="h-9 w-full animate-pulse rounded-md border border-slate-200 bg-slate-100" />
    </>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
      {/* FILTER BAR */}
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-4">
          <ClientOnly fallback={filterSkeleton}>
            <div className="contents">
              <Select value={declarationFilter} onValueChange={onDeclarationFilterChange}>
                <SelectTrigger className={FILTER_CONTROL_CLASS}>
                  <SelectValue placeholder="All declarations" />
                </SelectTrigger>
                <SelectContent position="popper" className={FILTER_SELECT_CONTENT_CLASS}>
                  <SelectItem value="all" className={FILTER_MENU_ITEM_CLASS}>All declarations</SelectItem>
                  {allDeclarationOptions.map((decl) => (
                    <SelectItem key={decl.id} value={decl.id} className={cn(FILTER_MENU_ITEM_CLASS, "font-mono")}>
                      {decl.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className={FILTER_CONTROL_CLASS}>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent position="popper" className={FILTER_SELECT_CONTENT_CLASS}>
                  <SelectItem value="all" className={FILTER_MENU_ITEM_CLASS}>All types</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.code} value={type.name} className={FILTER_MENU_ITEM_CLASS}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger className={cn(FILTER_CONTROL_CLASS, "flex items-center justify-between px-3 transition-colors hover:border-slate-400 focus:outline-none")}>
                  <span>Compliance Tools</span>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </DropdownMenuTrigger>

                <DropdownMenuContent className="z-[100] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-md" align="end">
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("preference")}
                    className={cn(FILTER_MENU_ITEM_CLASS, "cursor-pointer rounded-sm px-2 outline-none")}
                  >
                    Preference Checker
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("landed")}
                    className={cn(FILTER_MENU_ITEM_CLASS, "cursor-pointer rounded-sm px-2 outline-none")}
                  >
                    Landed Cost Calculator
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ClientOnly>

          <Button
            variant="ghost"
            className={cn(FILTER_CONTROL_CLASS, "transition-colors hover:border-slate-400 hover:bg-slate-50")}
            onClick={onGenerateTemplates}
            disabled={isGeneratingTemplates || !canGenerateTemplates}
          >
            {isGeneratingTemplates ? "Generating..." : "Generate templates"}
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase w-[40%]">DOCUMENT</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">TYPE</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">LINKED MRN</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">STATUS</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase text-right w-[80px]">DE 2/3</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-xs italic">
                  No documents found matching these filters.
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
  );
});
