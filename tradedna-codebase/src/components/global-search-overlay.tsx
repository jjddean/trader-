"use client";

import React, { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Search, Loader2, Globe, Building2, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface GlobalSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchOverlay({ isOpen, onClose }: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const runSearch = useAction(api.actions.companies.searchCompanies);
  const createProspect = useMutation(api.leads.createProspect);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await runSearch({ query: val });
      setResults(res.hits || []);
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
                Global Discovery Results
              </p>
              {results.map((hit) => (
                <div
                  key={hit.document.id}
                  className="group flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100">
                      <Building2 className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-black truncate">
                        {hit.document.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Globe className="h-2.5 w-2.5" />
                          {hit.document.country}
                        </span>
                        <span className="text-[10px] text-gray-400 py-0.5 px-1.5 bg-gray-100 rounded">
                          {hit.document.hscode}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await createProspect({
                        companyName: hit.document.name,
                        country: hit.document.country,
                        dctsTier: hit.document.category || "Standard",
                        primaryHS: hit.document.hscode,
                      });
                      onClose();
                    }}
                    className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-black transition-all hover:border-gray-900 hover:bg-black hover:text-white opacity-0 group-hover:opacity-100"
                  >
                    <Plus className="h-3 w-3" />
                    Save
                  </button>
                </div>
              ))}
            </div>
          ) : query.length >= 2 ? (
            <div className="py-12 text-center">
              <Search className="h-8 w-8 text-gray-200 mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">No global matches found</p>
              <p className="text-[10px] text-gray-400 mt-1">Try a different company name or HS code</p>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-400">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-20" />
              <p className="text-xs">Type to search millions of global trade partners</p>
            </div>
          )}
        </div>

        <DialogTitle className="sr-only">Global Trade Discovery</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}
