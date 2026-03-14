"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Users, Globe, Star, Loader2, Trash2 } from "lucide-react";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
    const [searchQuery, setSearchQuery] = useState("");
    const [isSyncing, setIsSyncing] = useState(false);
    const [countryFilter, setCountryFilter] = useState("");

    const leads = useQuery(api.leads.listLeads, {});
    const updateStatus = useMutation(api.leads.updateLeadStatus);
    const saveCompany = useMutation(api.saved_companies.saveCompany);
    const discoverLeads = useAction(api.ai.discoverLeads);
    const syncLeads = useMutation(api.leads.syncHMRCLeads);
    const clearLeads = useMutation(api.leads.clearAllLeads);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            console.log("Starting AI-driven HMRC discovery...");
            // 1. Fetch live discoveries from the Product Agent
            const discoveredLeads = await discoverLeads();
            
            // 2. Sync them to the Prospects database
            const result = await syncLeads({ leads: discoveredLeads });
            
            console.log(`Sync complete! Added ${result.count} new prospects.`);
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
        leads?.forEach((l: Lead) => {
            if (l.status && l.status in counts) {
                counts[l.status as keyof typeof counts]++;
            }
        });
        return counts;
    }, [leads]);

    const filteredLeads = useMemo(() => {
        return leads?.filter((lead: Lead) => {
            const matchesSearch = (lead.companyName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (lead.primaryHS ?? "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCountry = !countryFilter || lead.country === countryFilter;
            return matchesSearch && matchesCountry;
        });
    }, [leads, searchQuery, countryFilter]);

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

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
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">All Prospects</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="px-3 py-1 bg-black hover:bg-gray-800 text-white text-[0.6875rem] font-medium rounded-md transition-all disabled:opacity-50 flex items-center gap-2 mr-2"
                        >
                            {isSyncing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : null}
                            {isSyncing ? "Syncing..." : "Sync HMRC Data"}
                        </button>
                        <button
                            onClick={handleClear}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors mr-2"
                            title="Reset Pipeline"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <Select value={countryFilter || "all"} onValueChange={(val) => setCountryFilter(val === "all" ? "" : val)}>
                            <SelectTrigger className="h-7 bg-gray-50 border-gray-100 text-[0.6875rem] text-gray-600 w-[160px]">
                                <SelectValue placeholder="All Countries" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All Countries</SelectItem>
                                <SelectItem value="Bangladesh" className="text-xs">Bangladesh</SelectItem>
                                <SelectItem value="Pakistan" className="text-xs">Pakistan</SelectItem>
                                <SelectItem value="Kenya" className="text-xs">Kenya</SelectItem>
                                <SelectItem value="Cambodia" className="text-xs">Cambodia</SelectItem>
                                <SelectItem value="Vietnam" className="text-xs">Vietnam</SelectItem>
                                <SelectItem value="India" className="text-xs">India</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {filteredLeads && filteredLeads.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Country</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">HS Code</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">DCTS Tier</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Reliability</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredLeads.map((lead: Lead) => (
                                <tr key={lead._id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-xs font-medium text-black">{lead.companyName}</p>
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
                                        <span className={cn(
                                            "text-[0.625rem] font-medium px-2 py-0.5 rounded-md",
                                            lead.dctsTier === "Comprehensive" ? "bg-green-100 text-green-700" :
                                                lead.dctsTier === "Enhanced" ? "bg-blue-100 text-blue-700" :
                                                    "bg-gray-100 text-gray-700"
                                        )}>
                                            {lead.dctsTier}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                                <div
                                                    className="h-1.5 rounded-full bg-green-500"
                                                    style={{ width: `${((lead.reliabilityScore ?? 0.85) * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[0.625rem] text-gray-500">{((lead.reliabilityScore ?? 0.85) * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Select value={lead.status} onValueChange={(val) => updateStatus({ id: lead._id, status: val })}>
                                            <SelectTrigger
                                                className={cn(
                                                    "h-7 text-[0.625rem] font-medium px-2 rounded-md border-0 w-[120px]",
                                                    lead.status === "New" ? "bg-blue-100 text-blue-700" :
                                                        lead.status === "Contacted" ? "bg-orange-100 text-orange-700" :
                                                            lead.status === "Proposal Sent" ? "bg-purple-100 text-purple-700" :
                                                                "bg-green-100 text-green-700"
                                                )}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {STATUS_OPTIONS.map(s => (
                                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => saveCompany({
                                                companyName: lead.companyName ?? "",
                                                country: lead.country ?? "",
                                                category: lead.dctsTier ?? "",
                                            })}
                                            className="p-1.5 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Save company"
                                        >
                                            <Star className="h-3.5 w-3.5 text-gray-400" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="py-24 flex flex-col items-center justify-center text-center">
                        <Users className="h-8 w-8 text-gray-200 mb-4" />
                        <h3 className="text-gray-900 font-medium text-base mb-1">No Prospects Found</h3>
                        <p className="text-gray-500 text-sm max-w-[280px]">Use the sync button above to discover and import verified trade partners from the HMRC database.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
