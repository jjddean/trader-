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
      <div className="h-9 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
      <div className="h-9 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
      <div className="h-9 w-full animate-pulse rounded-md border border-gray-200 bg-gray-100" />
    </>
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#e9e9e7] bg-white shadow-none">
      {/* FILTER BAR */}
      <div className="border-b border-[#e9e9e7] bg-gray-50 px-5 py-4">
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-4">
          <ClientOnly fallback={filterSkeleton}>
            <div className="contents">
              <Select value={declarationFilter} onValueChange={onDeclarationFilterChange}>
                <SelectTrigger className="h-9 w-full border-gray-200 bg-white text-[0.6875rem] font-medium tracking-normal text-gray-600">
                  <SelectValue placeholder="All declarations" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] max-h-[300px]">
                  <SelectItem value="all" className="text-[0.6875rem]">All declarations</SelectItem>
                  {allDeclarationOptions.map((decl) => (
                    <SelectItem key={decl.id} value={decl.id} className="font-mono text-[0.6875rem]">
                      {decl.mrn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={onTypeFilterChange}>
                <SelectTrigger className="h-9 w-full border-gray-200 bg-white text-[0.6875rem] font-medium tracking-normal text-gray-600">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100] max-h-[300px]">
                  <SelectItem value="all" className="text-[0.6875rem]">All types</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.code} value={type.name} className="text-[0.6875rem]">
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-gray-600 transition-colors hover:border-gray-400 focus:outline-none shadow-sm">
                  <span>Compliance Tools</span>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </DropdownMenuTrigger>

                <DropdownMenuContent className="z-[100] min-w-[12rem] overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg" align="end">
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("preference")}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[0.6875rem] text-gray-700 outline-none hover:bg-gray-50 focus:bg-gray-50"
                  >
                    Preference Checker
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("roo")}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[0.6875rem] text-gray-700 outline-none hover:bg-gray-50 focus:bg-gray-50"
                  >
                    Rules of Origin
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onActiveToolChange("landed")}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[0.6875rem] text-gray-700 outline-none hover:bg-gray-50 focus:bg-gray-50"
                  >
                    Landed Cost Calculator
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </ClientOnly>

          <Button
            variant="ghost"
            className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-gray-600 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
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
            <tr className="bg-gray-50 border-b border-[#e9e9e7]">
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase w-[40%]">DOCUMENT</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">TYPE</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">LINKED MRN</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">STATUS</th>
              <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-gray-500 uppercase text-right w-[80px]">DE 2/3</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-xs italic">
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
                      {doc.mrn === "Unlinked" || doc.mrn === "Draft (Pending)" ? (
                        <span className="text-[0.6875rem] text-gray-400">—</span>
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
                      <span className="font-mono text-[0.6875rem] font-medium text-gray-400">{doc.de23}</span>
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
