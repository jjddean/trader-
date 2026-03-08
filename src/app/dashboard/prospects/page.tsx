"use client";

import React, { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    Users,
    Search,
    Filter,
    Globe,
    Star,
    MoreHorizontal,
    RefreshCw,
    ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = ["New", "Contacted", "Proposal Sent", "Client"];

export default function ProspectsPage() {
    const [countryFilter, setCountryFilter] = useState("");
    const [hsFilter, setHsFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    const leads = useQuery(api.leads.listLeads, {
        ...(countryFilter ? { country: countryFilter } : {}),
        ...(hsFilter ? { hsCode: hsFilter } : {}),
    });
    const savedCompanies = useQuery(api.saved_companies.getSavedCompanies);

    const updateStatus = useMutation(api.leads.updateLeadStatus);
    const syncLeads = useMutation(api.leads.syncHMRCLeads);
    const saveCompany = useMutation(api.saved_companies.saveCompany);

    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        await syncLeads({});
        setSyncing(false);
    };

    const filteredLeads = leads?.filter((l: any) =>
        !searchQuery || l.companyName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const statusCounts = {
        New: leads?.filter((l: any) => l.status === "New").length ?? 0,
        Contacted: leads?.filter((l: any) => l.status === "Contacted").length ?? 0,
        "Proposal Sent": leads?.filter((l: any) => l.status === "Proposal Sent").length ?? 0,
        Client: leads?.filter((l: any) => l.status === "Client").length ?? 0,
    };

    return (
        <div className="flex h-screen bg-white font-sans text-gray-600 overflow-hidden">
            <DashboardSidebar />

            <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Partner Discovery & Pipeline</h1>
                        <span className="px-1.5 py-0.5 rounded text-[0.5625rem] bg-blue-50 text-blue-600 border border-blue-100 font-medium tracking-wide">
                            {leads?.length ?? 0} PROSPECTS
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search prospects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className="h-8 px-3 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                            {syncing ? "Syncing..." : "Sync HMRC"}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">

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
                                        <SelectTrigger className="h-7 bg-gray-50 border-gray-100 text-[0.6875rem] text-gray-600 w-[140px]" size="sm">
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
                                        {filteredLeads.map((lead: any) => (
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
                                                            size="sm"
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
                </div>
            </main>
        </div>
    );
}
