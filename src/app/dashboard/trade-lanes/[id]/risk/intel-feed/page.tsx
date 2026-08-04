"use client";

import React, { useState } from "react";
import { ShieldAlert, Zap, Search, Filter, ExternalLink, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KineticIncident {
    id: string;
    type: "piracy" | "conflict" | "congestion" | "sanction";
    severity: "severe" | "high" | "medium";
    title: string;
    location: string;
    timestamp: string;
    description: string;
    recommendation: string;
    source: string;
}

const MOCK_INCIDENTS: KineticIncident[] = [
    {
        id: "1",
        type: "conflict",
        severity: "severe",
        title: "Kinetic Strike Near Black Sea Corridor",
        location: "44.2N, 31.5E",
        timestamp: "28 mins ago",
        description: "Confirmed drone engagement targeting merchant vessel infrastructure. Kinetic activity remains high across all northern routes.",
        recommendation: "IMMEDIATE DEVIATION: Suspend all Odessa-bound traffic until 06:00 UTC.",
        source: "Conflict Signals NLP"
    },
    {
        id: "2",
        type: "piracy",
        severity: "high",
        title: "Suspected Skiff Activity",
        location: "Gulf of Aden",
        timestamp: "2 hours ago",
        description: "Two high-speed skiffs identified loitering 15nm off Port of Aden. Uncharacteristic behavior detected by AIS pattern analysis.",
        recommendation: "ENHANCED VIGILANCE: Implement Level 2 security protocols for all transits.",
        source: "AIS Anomaly Detection"
    },
    {
        id: "3",
        type: "congestion",
        severity: "medium",
        title: "Port Congestion Spike",
        location: "Rotterdam (Maasvlakte)",
        timestamp: "5 hours ago",
        description: "Wait times for mega-vessels have increased by 15% due to sudden localized labor shortage signals in social media feeds.",
        recommendation: "LOGISTICS ALERT: Advise shippers of potential 24-hour discharge delay.",
        source: "NLP Logistics Sentiment"
    }
];

import { sendSevereRiskAlert } from "../actions/send-alert";

export default function IntelFeedPage() {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleTestAlert = async (incident: KineticIncident) => {
        setSending(true);
        const result = await sendSevereRiskAlert(incident);
        setSending(false);
        if (result.success) {
            setSent(true);
            setTimeout(() => setSent(false), 3000);
        }
    };

    return (
        <div className="flex min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">

            <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
                {/* Header */}
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight flex items-center gap-2">
                            Strategic Intel Feed
                        </h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-50 text-red-600 border border-red-100 font-medium tracking-wide flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5 fill-current" />
                            LIVE UPDATES
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => handleTestAlert(MOCK_INCIDENTS[0] as KineticIncident)}
                            disabled={sending}
                            className={cn(
                                "h-8 px-3 text-[11px] font-medium rounded-md border transition-all",
                                sent ? "bg-green-50 text-green-600 border-green-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                            )}
                        >
                            {sending ? "Sending..." : sent ? "Alert Sent!" : "Send Test Alert"}
                        </button>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search intel..."
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                            />
                        </div>
                        <button className="h-8 w-8 flex items-center justify-center border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
                            <Filter className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {MOCK_INCIDENTS.map((incident) => (
                            <div
                                key={incident.id}
                                className={cn(
                                    "bg-white border rounded-xl overflow-hidden transition-all hover:shadow-sm",
                                    incident.severity === 'severe' ? "border-red-200" : "border-gray-200"
                                )}
                            >
                                <div className="p-4 border-b border-gray-50 flex items-start justify-between bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                            incident.severity === 'severe' ? "bg-red-50" :
                                                incident.severity === 'high' ? "bg-orange-50" : "bg-blue-50"
                                        )}>
                                            <ShieldAlert className={cn(
                                                "h-4 w-4",
                                                incident.severity === 'severe' ? "text-red-500" :
                                                    incident.severity === 'high' ? "text-orange-500" : "text-blue-500"
                                            )} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-medium text-black">{incident.title}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-normal uppercase tracking-wider">{incident.location}</span>
                                                <span className="text-[10px] text-gray-200">•</span>
                                                <span className="text-[10px] text-gray-400 font-normal">{incident.timestamp}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px] text-gray-500 font-medium">
                                        <MessageCircle className="h-3 w-3" />
                                        Source: {incident.source}
                                    </div>
                                </div>
                                <div className="p-4 space-y-4">
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                        {incident.description}
                                    </p>

                                    <div className={cn(
                                        "p-3 rounded-lg border",
                                        incident.severity === 'severe' ? "bg-red-50/30 border-red-100" : "bg-gray-50 border-gray-100"
                                    )}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Zap className={cn(
                                                "h-3 w-3",
                                                incident.severity === 'severe' ? "text-red-500" : "text-gray-400"
                                            )} />
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Recommended Action</span>
                                        </div>
                                        <p className={cn(
                                            "text-xs font-medium",
                                            incident.severity === 'severe' ? "text-red-700" : "text-gray-700"
                                        )}>
                                            {incident.recommendation}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex -space-x-1">
                                            {[1, 2, 3].map((i) => (
                                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-gray-100 text-[8px] flex items-center justify-center font-medium text-gray-400">
                                                    U{i}
                                                </div>
                                            ))}
                                            <div className="pl-3 text-[10px] text-gray-400 flex items-center">
                                                Active routes in zone: 12 transits
                                            </div>
                                        </div>
                                        <button className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-black transition-colors px-2 py-1 rounded hover:bg-gray-50">
                                            Detail Report
                                            <ExternalLink className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}