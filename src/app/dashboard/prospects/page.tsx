"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Users, Globe, Star } from "lucide-react";

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
    companyName: string;
    country: string;
    primaryHS: string;
    dctsTier: string;
    reliabilityScore: number;
    status: "New" | "Contacted" | "Proposal Sent" | "Client" | string;
    contactEmail?: string;
};

export default function ProspectsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [countryFilter, setCountryFilter] = useState("");

    const leads = useQuery(api.leads.listLeads, {});
    const updateStatus = useMutation(api.leads.updateLeadStatus);
    const saveCompany = useMutation(api.saved_companies.saveCompany);

    const handleSync = () => {
        // Placeholder for HMRC sync logic
        console.log("Syncing HMRC data...");
    };

    const statusCounts = {
        New: leads?.filter((l: Lead) => l.status === "New").length ?? 0,
        Contacted: leads?.filter((l: Lead) => l.status === "Contacted").length ?? 0,
        "Proposal Sent": leads?.filter((l: Lead) => l.status === "Proposal Sent").length ?? 0,
        Client: leads?.filter((l: Lead) => l.status === "Client").length ?? 0,
    };

    const filteredLeads = leads?.filter((lead: Lead) => {
        const matchesSearch = lead.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.primaryHS?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCountry = !countryFilter || lead.country === countryFilter;
        return matchesSearch && matchesCountry;
    });

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
                    <div className="flex items-center gap-2">
                        <Select value={countryFilter || "all"} onValueChange={(val) => setCountryFilter(val === "all" ? "" : val)}>
                            <SelectTrigger className="h-7 bg-gray-50 border-gray-100 text-[0.6875rem] text-gray-600 w-[140px]">
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
                                                    style={{ width: `${(lead.reliabilityScore * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[0.625rem] text-gray-500">{(lead.reliabilityScore * 100).toFixed(0)}%</span>
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
                                                companyName: lead.companyName,
                                                country: lead.country,
                                                category: lead.dctsTier,
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
                    <div className="py-16 text-center">
                        <Users className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                        <h3 className="text-gray-600 font-normal text-sm mb-1">No Prospects Found</h3>
                        <p className="text-gray-400 text-xs mb-4">Sync HMRC data to discover trade partners.</p>
                        <button
                            onClick={handleSync}
                            className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors"
                        >
                            Sync HMRC Data
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
