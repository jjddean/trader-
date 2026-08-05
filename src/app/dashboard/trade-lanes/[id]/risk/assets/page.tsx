"use client";

import React from "react";
import {
    Ship,
    ShieldAlert,
    ArrowUpRight,
    ArrowDownRight,
    TrendingUp,
    Activity,
    Search,
    Filter,
    MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    AreaChart,
    Area,
    ResponsiveContainer
} from "recharts";

interface Asset {
    id: string;
    vessel: string;
    type: string;
    route: string;
    riskScore: number;
    trend: 'up' | 'down' | 'stable';
    status: 'In Transit' | 'Moored' | 'Anchored' | 'Delayed';
    eta: string;
    exposure: string; // Dollar value or relative weight
}

const MOCK_ASSETS: Asset[] = [
    {
        id: "1",
        vessel: "MARAN GAS APOLLONIA",
        type: "LNG Carrier",
        route: "Ras Laffan → Wilhelmshaven",
        riskScore: 24,
        trend: 'down',
        status: 'In Transit',
        eta: "Mar 04",
        exposure: "$125M"
    },
    {
        id: "2",
        vessel: "EVER GIVEN",
        type: "Container (ULCV)",
        route: "Yantian → Rotterdam",
        riskScore: 68,
        trend: 'up',
        status: 'In Transit',
        eta: "Mar 12",
        exposure: "$450M"
    },
    {
        id: "3",
        vessel: "VAKHTANG KIKABIDZE",
        type: "Crude Oil Tanker",
        route: "Novorossiysk → Mumbai",
        riskScore: 92,
        trend: 'stable',
        status: 'In Transit',
        eta: "Mar 10",
        exposure: "$85M"
    },
    {
        id: "4",
        vessel: "MSC TESSA",
        type: "Container (ULCV)",
        route: "Ningbo → Odessa",
        riskScore: 95,
        trend: 'up',
        status: 'Delayed',
        eta: "PAUSED",
        exposure: "$210M"
    },
    {
        id: "5",
        vessel: "CSCL GLOBE",
        type: "Container",
        route: "Shanghai → Felixstowe",
        riskScore: 12,
        trend: 'down',
        status: 'Moored',
        eta: "COMPLETED",
        exposure: "$180M"
    }
];

const MOCK_HISTORY = [
    { day: 'Feb 18', score: 32 },
    { day: 'Feb 19', score: 35 },
    { day: 'Feb 20', score: 42 },
    { day: 'Feb 21', score: 58 },
    { day: 'Feb 22', score: 65 },
    { day: 'Feb 23', score: 72 },
    { day: 'Feb 24', score: 68 },
    { day: 'Feb 25', score: 74 },
];

export default function AssetsPage() {
    return (
        <div className="flex min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">

            <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
                {/* Header */}
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-[14px] font-normal text-black tracking-tight flex items-center gap-2">
                            Fleet Asset Portfolio
                        </h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-50 text-blue-600 border border-blue-100 font-medium tracking-wide">
                            5 ASSETS TRACKED
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search vessels..."
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-[12px] text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                            />
                        </div>
                        <button className="h-8 px-3 bg-black hover:bg-gray-800 text-white text-[12px] font-normal rounded-md transition-colors">
                            Manage Groups
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">

                        {/* High-Level Fleet Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl p-5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <ShieldAlert className="h-12 w-12 text-red-500" />
                                </div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Fleet exposure index</p>
                                <div className="flex items-baseline gap-2">
                                    <h2 className="text-[24px] font-light text-black">58.4</h2>
                                    <span className="text-[12px] text-red-500 flex items-center font-medium">
                                        +4.2% <ArrowUpRight className="h-3 w-3" />
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1">Weighted average across $1.05B total AUM</p>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl p-5 col-span-2 flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">90-Day Fleet Risk Audit</p>
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3 text-red-400" />
                                        Ascending Risk Pattern Detected
                                    </span>
                                </div>
                                <div className="h-16 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={MOCK_HISTORY}>
                                            <defs>
                                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <Area
                                                type="monotone"
                                                dataKey="score"
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorScore)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Fleet Table */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-3">
                                    <Activity className="h-4 w-4 text-gray-400" />
                                    <h3 className="text-[14px] font-medium text-black">Active Asset Monitoring</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1.5 text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 hover:bg-gray-100 transition-colors">
                                        <Filter className="h-3 w-3" />
                                        Severity Filter
                                    </button>
                                </div>
                            </div>

                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Asset / Vessel</th>
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Transit Corridor</th>
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Risk Score</th>
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Exposure</th>
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">AIS Status</th>
                                        <th className="px-6 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider text-right">ETA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {MOCK_ASSETS.map((asset) => (
                                        <tr key={asset.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-7 h-7 rounded bg-gray-100 flex items-center justify-center text-gray-500",
                                                        asset.riskScore > 90 && "bg-red-50 text-red-500",
                                                        asset.riskScore > 60 && asset.riskScore <= 90 && "bg-orange-50 text-orange-500"
                                                    )}>
                                                        <Ship className="h-3.5 w-3.5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[12px] font-medium text-black">{asset.vessel}</p>
                                                        <p className="text-[10px] text-gray-400">{asset.type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-[11px] text-gray-600 truncate max-w-[180px]">{asset.route}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "text-[12px] font-semibold px-2 py-0.5 rounded-md",
                                                        asset.riskScore > 90 ? "bg-red-100 text-red-700" :
                                                            asset.riskScore > 60 ? "bg-orange-100 text-orange-700" :
                                                                "bg-green-100 text-green-700"
                                                    )}>
                                                        {asset.riskScore}
                                                    </span>
                                                    {asset.trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-red-400" /> :
                                                        asset.trend === 'down' ? <ArrowDownRight className="h-3 w-3 text-green-400" /> :
                                                            <div className="w-3 h-0.5 bg-gray-200" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-[11px] font-medium text-gray-500">
                                                {asset.exposure}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        asset.status === 'In Transit' ? "bg-green-500 animate-pulse" :
                                                            asset.status === 'Delayed' ? "bg-red-500" : "bg-gray-300"
                                                    )} />
                                                    <span className="text-[11px] text-gray-600">{asset.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className={cn(
                                                        "text-[10px] font-medium",
                                                        asset.eta === 'PAUSED' ? "text-red-500" : "text-gray-400"
                                                    )}>{asset.eta}</span>
                                                    <button className="p-1 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                        <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}