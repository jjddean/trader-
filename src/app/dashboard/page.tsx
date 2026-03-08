"use client";

import React from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import {
    TrendingUp,
    ShieldCheck,
    Users,
    Calculator,
    ArrowUpRight,
    ArrowDownRight,
    Globe,
    Clock,
    Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
    const { user } = useUser();
    const userId = user?.id || "";

    const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip");
    const leads = useQuery(api.leads.listLeads, {});
    const calcHistory = useQuery(api.calculator.getHistory);

    const verifiedLanes = lanes?.filter((l: any) => l.status === "Verified").length ?? 0;
    const reviewLanes = lanes?.filter((l: any) => l.status === "Review").length ?? 0;
    const totalSavings = lanes?.reduce((acc: number, l: any) => acc + (l.savingsEstimate || 0), 0) ?? 0;
    const newLeads = leads?.filter((l: any) => l.status === "New").length ?? 0;

    return (
        <div className="flex h-screen bg-white font-sans text-gray-600 overflow-hidden">
            <DashboardSidebar />

            <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Trade Intelligence Overview</h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 border border-gray-200 font-normal tracking-wide">
                            LIVE
                        </span>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">

                        {/* Top Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl p-5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Trade Lanes</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-2xl font-light text-black">{lanes?.length ?? "—"}</h2>
                                    <span className="text-[10px] text-green-500 font-medium flex items-center">
                                        {verifiedLanes} verified <ArrowUpRight className="h-3 w-3" />
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Active DCTS corridors</p>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Prospects</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-2xl font-light text-black">{leads?.length ?? "—"}</h2>
                                    <span className="text-[10px] text-blue-500 font-medium">{newLeads} new</span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Partner pipeline</p>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Est. Savings</p>
                                <h2 className="text-2xl font-light text-black">£{(totalSavings / 1000).toFixed(0)}k</h2>
                                <p className="text-[10px] text-gray-400 mt-1">DCTS duty relief</p>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Calculations</p>
                                <h2 className="text-2xl font-light text-black">{calcHistory?.length ?? "—"}</h2>
                                <p className="text-[10px] text-gray-400 mt-1">Landed cost runs</p>
                            </div>
                        </div>

                        {/* Two Columns: Recent Lanes + Recent Prospects */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Recent Trade Lanes */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <ShieldCheck className="h-4 w-4 text-gray-400" />
                                        <h3 className="text-sm font-medium text-black">Recent Trade Lanes</h3>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{lanes?.length ?? 0} total</span>
                                </div>
                                {lanes && lanes.length > 0 ? (
                                    <div className="divide-y divide-gray-50">
                                        {lanes.slice(0, 5).map((lane: any) => (
                                            <div key={lane._id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <Globe className="h-3.5 w-3.5 text-gray-400" />
                                                    <div>
                                                        <p className="text-xs font-medium text-black">{lane.originCountry}</p>
                                                        <p className="text-[10px] text-gray-400">{lane.commodityCode} · {lane.tier}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        lane.status === "Verified" ? "bg-green-500" :
                                                            lane.status === "Review" ? "bg-orange-500" : "bg-red-500"
                                                    )} />
                                                    <span className="text-[10px] text-gray-500">{lane.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center">
                                        <ShieldCheck className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                                        <p className="text-xs text-gray-400">No trade lanes yet</p>
                                    </div>
                                )}
                            </div>

                            {/* Recent Prospects */}
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Users className="h-4 w-4 text-gray-400" />
                                        <h3 className="text-sm font-medium text-black">Recent Prospects</h3>
                                    </div>
                                    <span className="text-[10px] text-gray-400">{leads?.length ?? 0} total</span>
                                </div>
                                {leads && leads.length > 0 ? (
                                    <div className="divide-y divide-gray-50">
                                        {leads.slice(0, 5).map((lead: any) => (
                                            <div key={lead._id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                                <div>
                                                    <p className="text-xs font-medium text-black">{lead.companyName}</p>
                                                    <p className="text-[10px] text-gray-400">{lead.country} · HS {lead.primaryHS}</p>
                                                </div>
                                                <span className={cn(
                                                    "text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
                                                    lead.status === "New" ? "bg-blue-100 text-blue-600" :
                                                        lead.status === "Contacted" ? "bg-orange-100 text-orange-600" :
                                                            lead.status === "Client" ? "bg-green-100 text-green-600" :
                                                                "bg-gray-100 text-gray-600"
                                                )}>
                                                    {lead.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center">
                                        <Users className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                                        <p className="text-xs text-gray-400">No prospects yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Calculations */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Calculator className="h-4 w-4 text-gray-400" />
                                    <h3 className="text-sm font-medium text-black">Recent Calculations</h3>
                                </div>
                            </div>
                            {calcHistory && calcHistory.length > 0 ? (
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50">
                                            <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">HS Code</th>
                                            <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Origin</th>
                                            <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                                            <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">Landed Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {calcHistory.slice(0, 5).map((calc: any) => (
                                            <tr key={calc._id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-3 text-[11px] font-mono text-gray-700">{calc.hsCode}</td>
                                                <td className="px-6 py-3 text-[11px] text-gray-600">{calc.originCountry}</td>
                                                <td className="px-6 py-3 text-[11px] text-gray-600">£{calc.value?.toLocaleString()}</td>
                                                <td className="px-6 py-3 text-[11px] font-medium text-black text-right">£{calc.totalLandedCost?.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="py-12 text-center">
                                    <Calculator className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-400">No calculations yet</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
