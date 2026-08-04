/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
"use client";

import { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Ship } from "lucide-react";
import { GeoRiskNavigator, GeoRiskData } from "@/components/georisk/ai/GeoRiskNavigator";
import { cn } from "@/lib/utils";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8001';

export default function Home() {
    const [lanes, setLanes] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);
    const [selectedLaneId, setSelectedLaneId] = useState<number | null>(null);
    const [startIndex, setStartIndex] = useState(0);

    // Mock Data for "Immediate" Feel if API fails
    useEffect(() => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 250);

        const fetchData = async () => {
            try {
                const [lanesRes, scoresRes] = await Promise.all([
                    fetch(`${apiUrl}/lanes/`, { signal: controller.signal }),
                    fetch(`${apiUrl}/risk-scores/`, { signal: controller.signal })
                ]);
                if (lanesRes.ok && scoresRes.ok) {
                    const lanesData = await lanesRes.json();
                    setLanes(lanesData);
                    setScores(await scoresRes.json());
                    if (lanesData.length > 0) {
                        setSelectedLaneId(lanesData[0].id);
                    }
                } else {
                    throw new Error("Local API offline");
                }
            } catch (error) {
                console.warn("Using high-fidelity mock data for Vercel demo");
                // HIGH FIDELITY MOCK FALLBACK
                const mockLanes = [
                    { id: 1, origin_port: { name: "Mumbai", longitude: 72.8777, latitude: 19.0760 }, destination_port: { name: "London", longitude: -0.1276, latitude: 51.5074 } },
                    { id: 2, origin_port: { name: "Shanghai", longitude: 121.4737, latitude: 31.2304 }, destination_port: { name: "Rotterdam", longitude: 4.4777, latitude: 51.9225 } },
                    { id: 3, origin_port: { name: "Singapore", longitude: 103.8198, latitude: 1.3521 }, destination_port: { name: "New York", longitude: -74.0060, latitude: 40.7128 } },
                    { id: 4, origin_port: { name: "Dubai", longitude: 55.2708, latitude: 25.2048 }, destination_port: { name: "Hamburg", longitude: 9.9937, latitude: 53.5511 } }
                ];
                const mockScores = [
                    { entityType: 'lane', entityId: 1, score: 82, status: 'watch', breakdown: { customs_friction: 45, weather: 12, zone: 85 } },
                    { entityType: 'lane', entityId: 2, score: 94, status: 'severe', breakdown: { customs_friction: 88, weather: 40, zone: 95 } },
                    { entityType: 'lane', entityId: 3, score: 22, status: 'safe', breakdown: { customs_friction: 10, weather: 5, zone: 15 } },
                    { entityType: 'lane', entityId: 4, score: 45, status: 'watch', breakdown: { customs_friction: 30, weather: 15, zone: 50 } },
                    { entityType: 'port', entityId: 1, breakdown: { congestion_forecast: 0.8 } },
                    { entityType: 'port', entityId: 2, breakdown: { congestion_forecast: 0.95 } }
                ];
                setLanes(mockLanes);
                setScores(mockScores);
                setSelectedLaneId(1);
            } finally {
                window.clearTimeout(timeout);
            }
        };
        fetchData();

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, []);

    // Helper to join data with ML-enhanced fields
    const getGeoRiskDataForLane = (lane: any): GeoRiskData => {
        const scoreData = scores.find(s => s.entityType === 'lane' && s.entityId === lane.id);
        const score = scoreData?.score || 0;
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE' = 'LOW';
        if (score >= 90) level = 'SEVERE';
        else if (score >= 80) level = 'HIGH';
        else if (score >= 30) level = 'MEDIUM';

        const originScore = scores.find(s => s.entityType === 'port' && s.entityId === lane.origin_port_id);
        const destScore = scores.find(s => s.entityType === 'port' && s.entityId === lane.destination_port_id);

        // Default Advisors
        let advisory = "Standard maritime monitoring active. No anomalies.";
        if (level === 'SEVERE') advisory = "CRITICAL: Extreme risk levels detected. Immediate deviation recommended.";
        if (level === 'HIGH') advisory = "CRITICAL: Immediate route assessment required due to active conflict zone proximity.";
        if (level === 'MEDIUM') advisory = "Advisory: Elevated risk factors detected in transit corridor.";

        // ... existing extraction logic
        const congestion = (originScore?.breakdown?.congestion_forecast || destScore?.breakdown?.congestion_forecast);
        const routing = scoreData?.breakdown?.route_alternative ? {
            has_safer_route: true,
            alternative: scoreData.breakdown.route_alternative
        } : undefined;

        return {
            score,
            level,
            advisory,
            factors: {
                zone: { score: scoreData?.breakdown?.zone || 0, weight: 0.4, details: [] },
                sanctions: { score: 0, weight: 0.4, details: [], available: true },
                weather: {
                    score: scoreData?.breakdown?.weather || 0,
                    weight: 0.2,
                    details: { description: "Real-time sync", windSpeed: 0, visibility: 10000 },
                    available: true
                },
                friction: {
                    score: scoreData?.breakdown?.customs_friction || 0,
                    weight: 1.0,
                    details: scoreData?.breakdown?.customs_friction ? ["Automated NLP detected trade friction signals"] : []
                }
            },
            congestion,
            routing,
            premium: true,
            lastUpdated: Date.now()
        };
    };

    return (
        <div className="flex min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Top Navigation Bar */}
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Portfolio Overview</h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 border border-gray-200 font-normal tracking-wide">
                            LIVE
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                            />
                        </div>
                        <button className="h-8 px-3 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors">
                            + Add Asset
                        </button>
                    </div>
                </header>

                {/* Dashboard Canvas */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                    {/* Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
                            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Total Assets</p>
                            <p className="text-sm font-normal text-black tracking-tight">{lanes.length}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
                            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Critical Risks</p>
                            <div className="flex items-baseline gap-2">
                                <p className="text-sm font-normal text-black tracking-tight">{scores.filter(s => s.status === 'severe').length}</p>
                                <span className="text-[10px] text-gray-500 font-normal">Action Req.</span>
                            </div>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
                            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Warning State</p>
                            <p className="text-sm font-normal text-black tracking-tight">{scores.filter(s => s.status === 'watch').length}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors group">
                            <p className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-1">Intel Signals</p>
                            <p className="text-sm font-normal text-black tracking-tight">12</p>
                        </div>
                    </div>

                    {/* Scenario Selector */}
                    {lanes.length > 0 && (
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 relative group/nav">
                            <h2 className="text-[9px] font-normal text-gray-400 uppercase tracking-widest mb-3 flex justify-between items-center">
                                Select Route Intelligence
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-300">Viewing {startIndex + 1}-{Math.min(startIndex + 4, lanes.length)} of {lanes.length}</span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            disabled={startIndex === 0}
                                            onClick={() => setStartIndex(Math.max(0, startIndex - 1))}
                                            className="p-1 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="h-3 w-3 text-gray-600" />
                                        </button>
                                        <button
                                            disabled={startIndex + 4 >= lanes.length}
                                            onClick={() => setStartIndex(Math.min(lanes.length - 4, startIndex + 1))}
                                            className="p-1 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="h-3 w-3 text-gray-600" />
                                        </button>
                                    </div>
                                </div>
                            </h2>

                            <div className="grid grid-cols-4 gap-2 flex-1">
                                {lanes.slice(startIndex, startIndex + 4).map((lane) => {
                                    const score = scores.find(s => s.entityType === 'lane' && s.entityId === lane.id)?.score || 0;
                                    return (
                                        <button
                                            key={lane.id}
                                            onClick={() => setSelectedLaneId(lane.id)}
                                            className={cn(
                                                "p-2.5 rounded-md border transition-all text-left bg-white",
                                                selectedLaneId === lane.id
                                                    ? "border-gray-500 ring-1 ring-gray-100 shadow-sm"
                                                    : "border-gray-200 hover:border-gray-300"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[10px]">
                                                        {score >= 90 ? '👾' :
                                                            score >= 80 ? '⛔' :
                                                                score >= 30 ? '⚠️' :
                                                                    <span className="text-green-500 font-bold tracking-tight text-[11px]">✓</span>}
                                                    </span>
                                                    <span className="text-[10px] font-normal text-black truncate">
                                                        {lane.origin_port?.name} → {lane.destination_port?.name}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-gray-400">
                                                Risk Score: {score}/100
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Main Feed - Single Card View */}
                    <div className="pb-4 max-w-5xl mx-auto">
                        {lanes.length > 0 ? (
                            (() => {
                                const selectedLane = lanes.find(l => l.id === selectedLaneId) || lanes[0];
                                return (
                                    <GeoRiskNavigator
                                        key={selectedLane.id}
                                        route={`${selectedLane.origin_port?.name} → ${selectedLane.destination_port?.name}`}
                                        data={getGeoRiskDataForLane(selectedLane)}
                                    />
                                );
                            })()
                        ) : (
                            <div className="py-16 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 border border-gray-200">
                                    <Ship className="h-5 w-5 text-gray-400" />
                                </div>
                                <h3 className="text-gray-600 font-normal text-sm mb-1">No Active Routes</h3>
                                <p className="text-gray-400 text-xs mb-4">Initialize a new route to begin risk analysis.</p>
                                <button className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors">
                                    Monitor New Route
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}