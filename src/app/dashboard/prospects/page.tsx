"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Users, Globe, Loader2, Trash2 } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const STATUS_OPTIONS = ["New", "Contacted", "Proposal Sent", "Client"];

type Lead = {
    _id: Id<"prospects">;
    companyName?: string;
    country?: string;
    primaryHS?: string;
    dctsTier?: string;
    reliabilityScore?: number;
    status?: string;
    contactEmail?: string;
    businessCategory?: string;
};

export default function ProspectsPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [countryFilter, setCountryFilter] = useState("");

    const leads = useQuery(api.leads.listLeads, {});
    const discoverLeads = useAction(api.ai.discoverLeads);
    const syncLeads = useMutation(api.leads.syncHMRCLeads);
    const clearLeads = useMutation(api.leads.clearAllLeads);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            console.log("Starting AI-driven HMRC discovery...");
            const discoveredLeads = await discoverLeads();
            const result = await syncLeads({ leads: discoveredLeads });
            
            if (result.count === 0) {
                alert("No new prospects found. Your database is already up to date with the latest HMRC discovery data.");
            } else {
                alert(`Discovery Complete! Successfully found and imported ${result.count} new trade partners.`);
            }
        } catch (error) {
            console.error("Sync failed:", error);
            alert("Discovery Failed: Ensure the Cloudflare Agent is running and accessible.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleClear = async () => {
        if (confirm("Are you sure you want to clear all prospects? This will reset your pipeline.")) {
            await clearLeads();
        }
    };

    const statusCounts = useMemo(() => {
        const counts = { New: 0, Contacted: 0, "Proposal Sent": 0, Client: 0 };
        (leads as Lead[])?.forEach((l: Lead) => {
            if (l.status && l.status in counts) {
                counts[l.status as keyof typeof counts]++;
            }
        });
        return counts;
    }, [leads]);

    const countries = useMemo(() => {
        const uniqueCountries = new Set((leads as Lead[])?.map(l => l.country).filter(Boolean));
        return Array.from(uniqueCountries).sort() as string[];
    }, [leads]);

    const filteredLeads = useMemo(() => {
        return (leads as Lead[])?.filter((lead: Lead) => {
            const matchesSearch = (lead.companyName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (lead.primaryHS ?? "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCountry = !countryFilter || lead.country === countryFilter;
            return matchesSearch && matchesCountry;
        });
    }, [leads, searchQuery, countryFilter]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* HMRC Discovery Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <h3 className="text-sm font-semibold text-black">HMRC Discovery</h3>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Search HMRC database for partners..."
                            className="w-full h-10 pl-4 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-black transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="px-6 h-10 bg-black hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {isSyncing ? "Syncing..." : "Sync HMRC Data"}
                    </button>
                    <button
                        onClick={handleClear}
                        className="h-10 px-3 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 rounded-lg transition-colors"
                        title="Clear All Prospects"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Pipeline Metrics */}
            <div className="grid grid-cols-4 gap-4">
                {STATUS_OPTIONS.map((status) => (
                    <div key={status} className="bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest mb-1">{status}</p>
                        <h2 className="text-2xl font-light text-black">{statusCounts[status as keyof typeof statusCounts]}</h2>
                    </div>
                ))}
            </div>

            {/* Prospects Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
                    <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">Active Pipeline</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        {countries.length > 0 && (
                            <Select value={countryFilter || "all"} onValueChange={(val: string) => setCountryFilter(val === "all" ? "" : val)}>
                                <SelectTrigger className="h-8 bg-white border-gray-200 text-xs text-gray-600 w-[160px]">
                                    <SelectValue placeholder="All Countries" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Countries</SelectItem>
                                    {countries.map((country: string) => (
                                        <SelectItem key={country} value={country || "unknown"} className="text-xs">{country}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {filteredLeads && filteredLeads.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Country</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">HS Code</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Reliability</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLeads.map((lead: Lead) => (
                                <tr 
                                    key={lead._id} 
                                    onClick={() => router.push(`/dashboard/prospects/${lead._id}`)}
                                    className="hover:bg-gray-50 cursor-pointer transition-colors group"
                                >
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-xs font-semibold text-black">{lead.companyName}</p>
                                            {lead.contactEmail && (
                                                <p className="text-[0.625rem] text-gray-400">{lead.contactEmail}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <Globe className="h-3 w-3 text-gray-400" />
                                            <span className="text-[0.6875rem] text-gray-600">{lead.country}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-[0.6875rem] font-mono text-gray-600">{lead.primaryHS}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                                            {lead.businessCategory || "Trade Partner"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                                                <div
                                                    className="h-1.5 rounded-full bg-green-500"
                                                    style={{ width: `${((lead.reliabilityScore ?? 0.85) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[0.625rem] text-gray-500">{((lead.reliabilityScore ?? 0.85) * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span
                                            className={cn(
                                                "inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap",
                                                lead.status === "New" ? "bg-blue-100 text-blue-700" :
                                                    lead.status === "Contacted" ? "bg-orange-100 text-orange-700" :
                                                        lead.status === "Proposal Sent" ? "bg-purple-100 text-purple-700" :
                                                            "bg-green-100 text-green-700"
                                            )}
                                        >
                                            {lead.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                        <Users className="h-8 w-8 text-gray-200 mb-4" />
                        <h3 className="text-gray-900 font-medium text-base mb-1">No Prospects Found</h3>
                        <p className="text-gray-500 text-sm max-w-[280px]">Use the HMRC discovery search above to find and save verified trade partners to your pipeline.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

