/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
'use client';

import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Info, AlertTriangle, Cloud, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import { RouteRiskChart } from './RouteRiskChart';
import { cn } from '@/lib/utils';

interface RiskFactor {
    score: number;
    weight: number;
    details: string[] | any;
    available?: boolean;
}

export interface GeoRiskData {
    score: number;
    available?: boolean;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
    advisory: string;
    factors?: {
        zone?: RiskFactor;
        sanctions?: RiskFactor;
        weather?: RiskFactor;
        friction?: RiskFactor; // Phase 1
    };
    congestion?: { // Phase 2
        level: 'low' | 'medium' | 'high';
        trend: 'increasing' | 'stable' | 'decreasing';
        forecast_3d: string;
        forecast_7d: string;
    };
    routing?: { // Phase 3
        has_safer_route: boolean;
        alternative?: {
            name: string;
            distance_km: number;
            savings_risk: number;
        };
    };
    premium?: boolean;
    lastUpdated?: number;
}

interface GeoRiskNavigatorProps {
    route: string;
    data: GeoRiskData;
    loading?: boolean;
}

export const GeoRiskNavigator: React.FC<GeoRiskNavigatorProps> = ({
    route,
    data,
    loading = false
}) => {
    const [showDetails, setShowDetails] = useState(true);
    const [showChart, setShowChart] = useState(true);
    const [showChanges, setShowChanges] = useState(true);

    const getStatusColor = () => {
        if (data.level === 'SEVERE') return 'text-purple-600 bg-purple-50 border-purple-200';
        if (data.level === 'HIGH') return 'text-red-600 bg-red-50 border-red-200';
        if (data.level === 'MEDIUM') return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        if (data.available === false) return 'text-slate-500 bg-slate-50 border-slate-200';
        return 'text-green-600 bg-green-50 border-green-200';
    };

    const getScoreColor = () => {
        if (data.score >= 90) return 'text-purple-600';
        if (data.score >= 80) return 'text-red-600';
        if (data.score >= 30) return 'text-yellow-600';
        return 'text-green-600';
    };

    if (loading) {
        return (
            <div className="overflow-hidden border-none shadow-lg animate-pulse rounded-lg bg-white">
                <div className="h-32 bg-slate-200" />
                <div className="p-6">
                    <div className="h-20 bg-slate-100 rounded mb-4" />
                    <div className="h-16 bg-slate-100 rounded" />
                </div>
            </div>
        );
    }

    return (
        <div className="overflow-hidden border-none shadow-lg rounded-lg bg-white font-sans">
            {/* Media Header with Text Overlay */}
            <div className="relative h-32 bg-slate-900">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10" />
                <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center" />

                <div className="absolute bottom-4 left-6 z-20">
                    <h3 className="text-white text-[20px] font-bold flex items-center gap-2 font-sans tracking-tight">
                        <ShieldAlert className="h-5 w-5 text-blue-400" />
                        GeoRisk Navigator™
                    </h3>
                    <p className="text-slate-300 text-[12px]">Route Intelligence: {route}</p>
                </div>
            </div>

            <div className="p-6 bg-white">
                {/* Score Display */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Route Risk Score</p>
                        <div className="flex items-baseline gap-2">
                            <span className={cn("text-[24px] font-bold", getScoreColor())}>{data.available === false ? "—" : data.score}</span>
                            <span className="text-[14px] text-slate-500">/ 100</span>
                        </div>
                    </div>
                    <div className={cn("flex items-center gap-1.5 rounded border px-2 py-1", getStatusColor())}>
                        <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            data.level === 'SEVERE' ? "bg-purple-500" :
                                data.level === 'HIGH' ? "bg-red-500" :
                                    data.level === 'MEDIUM' ? "bg-yellow-500" : "bg-green-500"
                        )} />
                        <span className="text-[10px] font-medium uppercase tracking-wide">
                            {data.available === false ? 'Awaiting Score' :
                                data.level === 'LOW' ? 'Low Risk' :
                                data.level === 'MEDIUM' ? 'Medium Risk' :
                                    data.level === 'HIGH' ? 'High Risk' :
                                        'Severe Risk'}
                        </span>
                    </div>
                </div>

                {/* Advisory & Route Alternatives (Phase 3) */}
                <div className="space-y-3 mb-4">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        <div className="flex gap-3">
                            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[12px] font-bold text-slate-900 mb-1">Prescriptive Advisory</p>
                                <p className="text-[14px] text-slate-600 leading-relaxed">{data.advisory}</p>
                            </div>
                        </div>
                    </div>

                    {data.routing?.has_safer_route && data.routing.alternative && (
                        <div className="bg-green-50 rounded-lg p-4 border border-green-100 border-l-4 border-l-green-500">
                            <div className="flex gap-3">
                                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-[12px] font-bold text-green-900 mb-1">Safe Passage Found (Phase 3)</p>
                                    <p className="text-[14px] text-green-800 font-medium">
                                        Alternative: via {data.routing.alternative.name}
                                    </p>
                                    <div className="mt-2 flex items-center gap-4 text-[10px] text-green-700">
                                        <span>• {data.routing.alternative.distance_km} km total</span>
                                        <span>• Risk Savings: {data.routing.alternative.savings_risk} pts</span>
                                    </div>
                                    <button className="mt-2 text-[10px] bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors uppercase font-bold tracking-wider">
                                        Recalculate Voyage
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Risk Factors Breakdown - Collapsible */}
                <div className="mt-8 border-t border-slate-100 pt-4">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between mb-3 text-[12px] font-semibold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
                    >
                        <span>Risk Factor Breakdown</span>
                        {showDetails ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                    </button>

                    {showDetails && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Zone Risk */}
                            {data.factors?.zone && (
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-blue-600" />
                                            <span className="text-[12px] font-bold text-blue-900">Zone Risk</span>
                                        </div>
                                        <span className="text-[14px] font-bold text-blue-600">
                                            {data.factors.zone.score} pts (×{data.factors.zone.weight})
                                        </span>
                                    </div>
                                    {Array.isArray(data.factors.zone.details) && data.factors.zone.details.length > 0 ? (
                                        <ul className="space-y-1">
                                            {data.factors.zone.details.map((detail: string, i: number) => (
                                                <li key={i} className="text-[12px] text-blue-800 flex items-start gap-1">
                                                    <span className="mt-1">•</span>
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[12px] text-blue-700">No zone-based risks detected</p>
                                    )}
                                </div>
                            )}

                            {/* Sanctions Risk */}
                            {data.factors?.sanctions && (
                                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Scale className="h-4 w-4 text-purple-600" />
                                            <span className="text-[12px] font-bold text-purple-900">Sanctions Screening</span>
                                        </div>
                                        <span className="text-[14px] font-bold text-purple-600">
                                            {data.factors.sanctions.score} pts (×{data.factors.sanctions.weight})
                                        </span>
                                    </div>
                                    {data.factors.sanctions.details?.length ? (
                                        <ul className="space-y-1">
                                            {data.factors.sanctions.details.map((detail: any, i: number) => (
                                                <li key={i} className="text-[12px] text-purple-800">
                                                    • {detail.party}: {detail.matched ? 'Match found' : 'Clear'}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[12px] text-purple-700">✓ No sanctions matches detected</p>
                                    )}
                                </div>
                            )}

                            {/* Weather Risk */}
                            {data.factors?.weather && (
                                <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Cloud className="h-4 w-4 text-cyan-600" />
                                            <span className="text-[12px] font-bold text-cyan-900">Weather Impact</span>
                                        </div>
                                        <span className="text-[14px] font-bold text-cyan-600">
                                            {data.factors.weather.score} pts (×{data.factors.weather.weight})
                                        </span>
                                    </div>
                                    {data.factors.weather.details && (
                                        <div className="text-[12px] text-cyan-800 space-y-1">
                                            <p>Conditions: {data.factors.weather.details.description}</p>
                                            <p>Wind: {data.factors.weather.details.windSpeed} m/s | Visibility: {data.factors.weather.details.visibility}m</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Customs & Friction (Phase 1) */}
                            {data.factors?.friction && (
                                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Scale className="h-4 w-4 text-indigo-600" />
                                            <span className="text-[12px] font-bold text-indigo-900">Customs & Trade Friction</span>
                                        </div>
                                        <span className="text-[14px] font-bold text-indigo-600">
                                            {data.factors.friction.score} pts
                                        </span>
                                    </div>
                                    {Array.isArray(data.factors.friction.details) && data.factors.friction.details.length > 0 ? (
                                        <ul className="space-y-1">
                                            {data.factors.friction.details.map((detail: string, i: number) => (
                                                <li key={i} className="text-[12px] text-indigo-800 flex items-start gap-1">
                                                    <span className="mt-1">•</span>
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[12px] text-indigo-700">No regulatory friction detected</p>
                                    )}
                                </div>
                            )}

                            {/* Congestion Forecast (Phase 2) */}
                            {data.congestion && (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-slate-600" />
                                            <span className="text-[12px] font-bold text-slate-900">Predictive Congestion</span>
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border",
                                            data.congestion.trend === 'increasing' ? "text-red-600 bg-red-50 border-red-100" : "text-green-600 bg-green-50 border-green-100"
                                        )}>
                                            Trend: {data.congestion.trend}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="p-2 bg-white rounded border border-slate-100 text-center">
                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">3-Day Forecast</p>
                                            <p className="text-[12px] font-bold text-slate-700 uppercase">{data.congestion.forecast_3d}</p>
                                        </div>
                                        <div className="p-2 bg-white rounded border border-slate-100 text-center">
                                            <p className="text-[9px] text-slate-400 uppercase font-semibold">7-Day Forecast</p>
                                            <p className="text-[12px] font-bold text-slate-700 uppercase">{data.congestion.forecast_7d}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Route Risk Timeline - Collapsible */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <button
                        onClick={() => setShowChart(!showChart)}
                        className="w-full flex items-center justify-between mb-3 text-[12px] font-semibold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
                    >
                        <span>Route Risk Timeline</span>
                        {showChart ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                    </button>

                    {showChart && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <RouteRiskChart route={route} riskLevel={data.level} />
                        </div>
                    )}
                </div>

                {/* Risk Change Detection - Collapsible (New) */}
                <div className="mt-4 border-t border-slate-100 pt-4">
                    <button
                        onClick={() => setShowChanges(!showChanges)}
                        className="w-full flex items-center justify-between mb-3 text-[12px] font-semibold text-slate-700 uppercase tracking-wider hover:text-slate-900 transition-colors"
                    >
                        <span>Risk Change Detection (Audit)</span>
                        {showChanges ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                    </button>

                    {showChanges && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
                                <span className="text-[12px] font-medium text-slate-600">Active Scan vs Previous (24h)</span>
                                <span className="text-[12px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">+23 pts</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2 text-[12px]">
                                    <div className="mt-0.5 p-1 bg-red-100 rounded-full">
                                        <AlertTriangle className="h-3 w-3 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">New Critical Event</p>
                                        <p className="text-slate-500">Choke point tension escalated (Strait Entry)</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Detected: 2 hours ago by GeoFeed</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 text-[12px]">
                                    <div className="mt-0.5 p-1 bg-green-100 rounded-full">
                                        <ShieldCheck className="h-3 w-3 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">Weather Clearance</p>
                                        <p className="text-slate-500">Storm warning lifted for North Sea segment</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Detected: 5 hours ago</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-100">
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    Changes are continuously monitored and logged. Decision audit trails and exports are available on Enterprise.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Free Tier Upgrade Prompt */}
                {!data.premium && (
                    <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
                        <p className="text-[14px] font-semibold text-blue-900 mb-2">🔒 Upgrade for Full Analysis</p>
                        <p className="text-[12px] text-blue-700 mb-3">
                            Get detailed sanctions screening, weather impact, and real-time risk monitoring with Pro.
                        </p>
                        <button className="text-[12px] bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors">
                            Upgrade to Pro
                        </button>
                    </div>
                )}

                <p className="mt-4 text-[10px] text-slate-400 italic">
                    *Analysis powered by GeoRisk Navigator™. Last updated: <span suppressHydrationWarning>{new Date(data.lastUpdated || Date.now()).toLocaleString()}</span>.
                </p>
            </div>
        </div >
    );
};
