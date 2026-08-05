"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Zap, Search, Filter, ExternalLink, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KineticIncident {
    id: string;
    type: string;
    severity: "severe" | "high" | "medium";
    title: string;
    location: string;
    timestamp: string;
    description: string;
    recommendation: string;
    source: string;
}

interface GeoRiskAlert {
    id: number;
    severity: "severe" | "high" | "medium" | "low";
    title: string;
    message: string;
    entity_type: string;
    entity_id: number;
    created_at: string;
}

function toIncident(alert: GeoRiskAlert): KineticIncident {
    return {
        id: String(alert.id),
        type: alert.entity_type,
        severity: alert.severity === "low" ? "medium" : alert.severity,
        title: alert.title,
        location: `${alert.entity_type} ${alert.entity_id}`,
        timestamp: new Date(alert.created_at).toLocaleString(),
        description: alert.message,
        recommendation: alert.message,
        source: "GeoRisk Alert Engine",
    };
}
import { sendSevereRiskAlert } from "../actions/send-alert";

export default function IntelFeedPage() {
    const [incidents, setIncidents] = useState<KineticIncident[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);


    useEffect(() => {
        const controller = new AbortController();
        const loadAlerts = async () => {
            try {
                const response = await fetch("/api/georisk/alerts", { signal: controller.signal });
                if (!response.ok) throw new Error("GeoRisk alerts unavailable");
                const alerts = (await response.json()) as GeoRiskAlert[];
                setIncidents(alerts.map(toIncident));
            } catch {
                if (!controller.signal.aborted) setIncidents([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void loadAlerts();
        return () => controller.abort();
    }, []);
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
                        <h1 className="text-[14px] font-normal text-black tracking-tight flex items-center gap-2">
                            Strategic Intel Feed
                        </h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-50 text-red-600 border border-red-100 font-medium tracking-wide flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5 fill-current" />
                            LIVE UPDATES
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => incidents[0] && handleTestAlert(incidents[0])}
                            disabled={sending || incidents.length === 0}
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
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-[12px] text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
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
                        {loading ? (
                            <p className="py-12 text-center text-[12px] text-gray-400">Loading intelligence…</p>
                        ) : incidents.length === 0 ? (
                            <p className="py-12 text-center text-[12px] text-gray-400">No GeoRisk alerts available.</p>
                        ) : incidents.map((incident) => (
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
                                            <h3 className="text-[14px] font-medium text-black">{incident.title}</h3>
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
                                    <p className="text-[12px] text-gray-600 leading-relaxed">
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
                                            "text-[12px] font-medium",
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