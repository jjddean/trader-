"use client";

import { useState } from 'react';
import { Search, Loader2, AlertCircle } from 'lucide-react';
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

    const searchHMRC = useAction(api.hmrc_actions.searchHSCode);

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
            setResults(formatted);

            if (formatted.length === 0) {
                toast.info("No results found. Try a different search term.");
            }
        } catch (error) {
            console.error("HMRC Search failed:", error);
            toast.error("Search failed. Please try again.");
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn("space-y-0", className)}>
            {/* Search Bar — matching app-wide pattern */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between border-b border-[#e9e9e7] pb-4 mb-0">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by product description or HS Code (e.g. 'Coffee', '8517')..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-gray-400 md:max-w-lg"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={loading || !searchTerm.trim()}
                    className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                </button>
            </div>

            {/* Results Table */}
            <div className="rounded-xl border border-[#e9e9e7] bg-white shadow-sm overflow-hidden mt-6">
                {loading ? (
                    <div className="flex h-40 flex-col items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                        <p className="text-xs text-gray-400">Searching HMRC Trade Tariff...</p>
                    </div>
                ) : searched && results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <AlertCircle className="mb-4 h-8 w-8 text-gray-300" />
                        <h3 className="text-sm font-medium text-gray-900">No HS Codes found</h3>
                        <p className="mt-1 text-xs text-gray-500">
                            No results for &ldquo;{searchTerm}&rdquo;. Try a different description or code.
                        </p>
                    </div>
                ) : results.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-[#e9e9e7] bg-gray-50/50">
                                <tr>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">HS Code</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase">Description</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-500 uppercase text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e9e9e7]">
                                {results.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        onClick={() => {
                                            navigator.clipboard.writeText(item.code);
                                            toast.success(`Code ${item.code} copied to clipboard`);
                                        }}
                                        className="group cursor-pointer transition-colors hover:bg-gray-50"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs font-semibold text-gray-900">
                                                {item.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[0.6875rem] text-gray-600 leading-snug max-w-md">
                                            {item.description}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[0.625rem] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                                                COPY CODE
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Search className="mb-4 h-8 w-8 text-gray-300" />
                        <h3 className="text-sm font-medium text-gray-900">Search the HMRC Trade Tariff</h3>
                        <p className="mt-1 text-xs text-gray-500">
                            Enter a product description or HS code above to look up commodity codes.
                        </p>
                    </div>
                )}
            </div>

            {/* Footer attribution */}
            <div className="mt-3 text-right">
                <span className="text-[0.625rem] text-gray-400">Source: HMRC Official Trade Tariff API</span>
            </div>
        </div>
    );
};
