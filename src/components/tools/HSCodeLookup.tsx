"use client";

import { useState, useEffect } from 'react';
import { Search, Loader2, AlertCircle, BookOpen, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface HSCode {
    code: string;
    description: string;
    matchType?: string;
}

interface HSCodeLookupProps {
    variant?: 'default' | 'minimal';
    className?: string;
}

export const HSCodeLookup = ({ variant = 'default', className }: HSCodeLookupProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<HSCode[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    
    // Static data for instant suggestions/type assists
    const [staticCodes, setStaticCodes] = useState<{code: string, desc: string}[]>([]);
    const [instantResults, setInstantResults] = useState<HSCode[]>([]);

    const searchHMRC = useAction(api.hmrc_actions.searchHSCode);

    // Load static codes for instant lookup
    useEffect(() => {
        fetch('/hs-codes.json')
            .then(res => res.json())
            .then(data => setStaticCodes(data))
            .catch(err => console.error("Failed to load static HS codes:", err));
    }, []);

    // Perform instant search as user types
    useEffect(() => {
        if (searchTerm.length >= 2 && staticCodes.length > 0) {
            const term = searchTerm.toLowerCase();
            const filtered = staticCodes
                .filter(item => 
                    item.code.includes(term) || 
                    item.desc.toLowerCase().includes(term)
                )
                .slice(0, 50) 
                .map(item => ({
                    code: item.code,
                    description: item.desc,
                    matchType: 'local'
                }));
            setInstantResults(filtered);
            setSearched(true);
        } else {
            setInstantResults([]);
            if (searchTerm.length < 2) setSearched(false);
        }
    }, [searchTerm, staticCodes]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;

        setLoading(true);
        setSearched(true);

        try {
            const officialResults = await searchHMRC({ query: searchTerm });
            const formatted = (officialResults || []).map((r: any) => ({
                code: r.code,
                description: r.description,
                matchType: r.matchType,
            }));
            
            // If local data has specific results that HMRC doesn't, we can merge or fallback
            const localResults = staticCodes
                .filter(item => item.code === searchTerm || item.code.startsWith(searchTerm))
                .slice(0, 5)
                .map(item => ({
                    code: item.code,
                    description: item.desc,
                    matchType: 'local'
                }));

            const merged = [...formatted];
            // Add local ones not already in formatted
            localResults.forEach(lr => {
                if (!merged.find(m => m.code === lr.code)) {
                    merged.push(lr);
                }
            });

            setResults(merged);

            if (merged.length === 0) {
                toast.info("No results found. Try a different search term.");
            }
        } catch (error) {
            console.error("HMRC Search failed:", error);
            toast.error("Official search failed. Using local database.");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (e: React.MouseEvent, code: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        toast.success(`Code ${code} copied to clipboard`);
    };

    const openTariffPage = (e: React.MouseEvent, code: string) => {
        e.stopPropagation();
        const cleanCode = code.replace(/\s/g, '');
        window.open(`https://www.trade-tariff.service.gov.uk/commodities/${cleanCode}`, '_blank');
    };

    const displayResults = results.length > 0 ? results : instantResults;

    return (
        <div className={cn("space-y-6", className)}>

            {/* Search Input - Matching Screenshot Style, but smaller */}
            <div className="flex w-full items-center gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500/10 transition-all shadow-sm">
                <input
                    type="text"
                    placeholder="Search by product description or HS Code..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-grow px-4 py-2.5 text-slate-700 outline-none placeholder:text-slate-400 text-sm"
                />
                <button
                    onClick={handleSearch}
                    disabled={loading || !searchTerm.trim()}
                    className="flex aspect-square h-[42px] items-center justify-center text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
            </div>

            {/* Results Section - List of Cards */}
            <div className="space-y-4">
                {loading && results.length === 0 && (
                    <div className="flex h-40 flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <p className="text-sm text-slate-500 font-medium">Querying Trade Tariff API...</p>
                    </div>
                )}

                {searched && displayResults.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <AlertCircle className="mb-3 h-8 w-8 text-slate-300" />
                        <h3 className="text-sm font-semibold text-slate-900">No results found</h3>
                        <p className="mt-1 text-xs text-slate-500 max-w-xs">
                            We couldn't find matches for &ldquo;{searchTerm}&rdquo;. Try broader keywords.
                        </p>
                    </div>
                )}

                {displayResults.length > 0 && (
                    <div className="grid grid-cols-1 gap-3">
                        {displayResults.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => openTariffPage(e, item.code)}
                                className="group relative flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-bold tracking-tight text-blue-600">
                                        {item.code}
                                    </span>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => copyToClipboard(e, item.code)}
                                            className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            COPY
                                        </button>
                                        <button 
                                            onClick={(e) => openTariffPage(e, item.code)}
                                            className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                        >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            TARIFF
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[13px] leading-relaxed text-slate-600 font-medium pr-4">
                                    {item.description}
                                </p>
                                
                                {item.matchType === 'local' && (
                                    <div className="absolute top-5 right-5 group-hover:hidden">
                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                                            Suggestion
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!searched && !loading && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                            <Search className="h-6 w-6 text-slate-300" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 leading-tight">Instant Tariff Search</h3>
                        <p className="mt-2 text-sm text-slate-500 max-w-sm font-medium">
                            Lookup thousands of commodity codes instantly. Find the correct code for your imports.
                        </p>
                    </div>
                )}
            </div>

            {/* Source and Stats */}
            <div className="flex items-center justify-between px-2 pt-2">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                    Official HMRC Trade Tariff + Local Index
                </span>
                {searched && (
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {displayResults.length} {displayResults.length === 1 ? 'match' : 'matches'}
                    </span>
                )}
            </div>
        </div>
    );
};
