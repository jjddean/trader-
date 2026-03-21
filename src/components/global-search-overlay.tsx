"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Search, Loader2, Globe, Building2, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchOverlay({ isOpen, onClose }: GlobalSearchOverlayProps) {
  const { user } = useUser();
  const userId = user?.id || "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const allDeclarations = useQuery(api.declarations.getAllDecls);
  const documents = useQuery(api.documents.getDocuments, userId ? { userId } : "skip");
  const declarations = (allDeclarations || []).filter((decl: any) => decl.userId === userId);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const term = val.toLowerCase();
      const declarationResults = declarations
        .filter((decl: any) =>
          String(decl.mrn || "").toLowerCase().includes(term) ||
          String(decl.eori || "").toLowerCase().includes(term) ||
          String(decl.status || "").toLowerCase().includes(term) ||
          String(decl._id || "").toLowerCase().includes(term),
        )
        .slice(0, 10)
        .map((decl: any) => ({
          id: `decl-${decl._id}`,
          kind: "declaration",
          title: decl.mrn || "— pending",
          subtitle: `${decl.eori || "Unknown EORI"} • ${decl.status || "Draft"}`,
          meta: String(decl._id),
        }));

      const documentResults = (documents || [])
        .filter((doc: any) =>
          String(doc.fileName || "").toLowerCase().includes(term) ||
          String(doc.mrn || "").toLowerCase().includes(term) ||
          String(doc.status || "").toLowerCase().includes(term) ||
          String(doc.declarationId || "").toLowerCase().includes(term),
        )
        .slice(0, 10)
        .map((doc: any) => ({
          id: `doc-${doc._id}`,
          kind: "document",
          title: doc.fileName || "Unknown document",
          subtitle: `${doc.mrn || "Unlinked"} • ${doc.status || "pending"}`,
          meta: String(doc.declarationId || ""),
        }));

      setResults([...declarationResults, ...documentResults]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none bg-white shadow-2xl">
        <DialogHeader className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              autoFocus
              className="flex-1 text-sm bg-transparent border-none outline-none text-black placeholder:text-gray-400"
              placeholder="Search global companies, HS codes, or countries..."
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Search Results
              </p>
              {results.map((hit) => (
                <div
                  key={hit.id}
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100">
                      {hit.kind === "document" ? (
                        <FileText className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Building2 className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-black truncate">
                        {hit.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5" />
                          {hit.kind === "document" ? "Document" : "Declaration"}
                        </span>
                        <span className="text-[10px] text-gray-400 py-0.5 px-1.5 bg-gray-100 rounded">
                          {hit.meta}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">{hit.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-12 text-center">
              <Search className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">No matches found</p>
              <p className="text-[10px] text-gray-400 mt-1">Try MRN, declaration ID, document name, or status</p>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-xs">Type to search declarations and documents</p>
            </div>
          )}
        </div>

        <DialogTitle className="sr-only">Global Search</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}
