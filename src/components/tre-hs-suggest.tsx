"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { History, Search } from "lucide-react";
import { countries } from "@/lib/data/countries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TreHsSuggest({ embedded = false }: { embedded?: boolean }) {
  const [origin, setOrigin] = useState("");
  const suggestion = useQuery(
    api.analytics.suggestFromHistory,
    origin.length === 2 ? { originCountry: origin.toUpperCase() } : "skip",
  );

  return (
    <div
      className={
        embedded
          ? "rounded-xl border border-slate-200 bg-slate-50/50 p-4"
          : "rounded-xl border border-slate-200 bg-white p-6"
      }
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-black">
        <History className="h-4 w-4 text-slate-400" />
        HS code from your history
      </div>
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        Most frequent commodity code from your imported TRE rows for a given origin country.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Country of origin
          </label>
          <Select value={origin || undefined} onValueChange={setOrigin}>
            <SelectTrigger className="h-9 w-full rounded-md border-slate-200 bg-slate-50 text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none">
              <SelectValue placeholder="Choose a country…" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[110] max-h-[300px]">
              {countries.map((c) => (
                <SelectItem key={c.code} value={c.code} className="text-xs">
                  {c.name} ({c.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {origin.length === 2 && suggestion !== undefined && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            {suggestion.hsCode ? (
              <span>
                Suggested <strong className="font-mono">{suggestion.hsCode}</strong> ({suggestion.confidence}%
                of imported rows)
              </span>
            ) : (
              <span className="text-slate-500">No history for this origin in TRE imports.</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
