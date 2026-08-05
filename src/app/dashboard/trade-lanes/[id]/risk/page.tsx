"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { Ship } from "lucide-react";
import { GeoRiskNavigator, GeoRiskData } from "@/components/georisk/ai/GeoRiskNavigator";
import { MaerskPortVerification } from "@/components/georisk/maersk-port-verification";
import { api } from "../../../../../../convex/_generated/api";
import { findGeoRiskLane, type GeoRiskLane, type GeoRiskScore, normalizeGeoRiskScore } from "@/lib/georisk-data";

export default function Home() {
    const { id } = useParams<{ id: string }>();
    const workspaceLane = useQuery(api.trade_lanes.get, { laneId: id });
    const [scores, setScores] = useState<GeoRiskScore[]>([]);
    const [matchedGeoRiskLane, setMatchedGeoRiskLane] = useState<GeoRiskLane | null>(null);
    const lanes = workspaceLane ? [{
        id: workspaceLane._id,
        origin_port: {
            id: workspaceLane.originUNLocode,
            name: workspaceLane.originName,
            unlocode: workspaceLane.originUNLocode,
            countryCode: workspaceLane.originCountryCode,
        },
        destination_port: {
            id: workspaceLane.destinationUNLocode,
            name: workspaceLane.destinationName,
            unlocode: workspaceLane.destinationUNLocode,
            countryCode: workspaceLane.destinationCountryCode,
        },
    }] : [];

    useEffect(() => {
        const controller = new AbortController();
        if (!workspaceLane) return () => controller.abort();

        void Promise.all([
            fetch("/api/georisk/lanes", { signal: controller.signal }),
            fetch("/api/georisk/risk-scores", { signal: controller.signal }),
        ]).then(async ([lanesResponse, scoresResponse]) => {
            if (!lanesResponse.ok || !scoresResponse.ok) throw new Error("GeoRisk unavailable");
            const availableLanes = await lanesResponse.json() as GeoRiskLane[];
            const rawScores = await scoresResponse.json() as Record<string, unknown>[];
            if (!controller.signal.aborted) {
                setMatchedGeoRiskLane(findGeoRiskLane(
                    availableLanes,
                    workspaceLane.originUNLocode,
                    workspaceLane.destinationUNLocode,
                ) ?? null);
                setScores(rawScores.map(normalizeGeoRiskScore));
            }
        }).catch(() => {
            if (!controller.signal.aborted) {
                setMatchedGeoRiskLane(null);
                setScores([]);
            }
        });
        return () => controller.abort();
    }, [workspaceLane]);

    // Helper to join data with ML-enhanced fields
    const getGeoRiskDataForLane = (): GeoRiskData => {
        const scoreData = matchedGeoRiskLane
            ? scores.find(s => s.entityType === 'lane' && s.entityId === matchedGeoRiskLane.id)
            : undefined;
        const score = scoreData?.score ?? 0;
        const scoreAvailable = Boolean(scoreData);
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE' = 'LOW';
        if (score >= 90) level = 'SEVERE';
        else if (score >= 80) level = 'HIGH';
        else if (score >= 30) level = 'MEDIUM';

        let advisory = scoreAvailable
            ? "Standard maritime monitoring active. No anomalies."
            : "No GeoRisk score is available for this UN/LOCODE pair yet.";
        if (level === 'SEVERE') advisory = "CRITICAL: Extreme risk levels detected. Immediate deviation recommended.";
        if (level === 'HIGH') advisory = "CRITICAL: Immediate route assessment required.";
        if (level === 'MEDIUM') advisory = "Advisory: Elevated risk factors detected.";
        return {
            score,
            level,
            available: scoreAvailable,
            advisory,
            factors: {
                zone: { score: Number(scoreData?.breakdown?.zone ?? 0), weight: 0.4, details: [] },
                friction: {
                    score: Number(scoreData?.breakdown?.customs_friction ?? 0),
                    weight: 1.0,
                    details: scoreData?.breakdown?.customs_friction ? ["Trade friction signal detected by GeoRisk"] : []
                }
            },
        };
    };

    return (
        <div className="flex min-h-[640px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Top Navigation Bar */}
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-[14px] font-normal text-black tracking-tight">Lane Risk Overview</h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 border border-gray-200 font-normal tracking-wide">
                            LIVE
                        </span>
                    </div>
                </header>

                {/* Dashboard Canvas */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                    {/* Lane summary */}
                    {workspaceLane && (
                        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="mb-1 text-[9px] uppercase tracking-widest text-gray-400">Lane</p><p className="text-[12px] font-medium text-black">{workspaceLane.code}</p></div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="mb-1 text-[9px] uppercase tracking-widest text-gray-400">Origin</p><p className="text-[12px] font-medium text-black">{workspaceLane.originUNLocode}</p></div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="mb-1 text-[9px] uppercase tracking-widest text-gray-400">Destination</p><p className="text-[12px] font-medium text-black">{workspaceLane.destinationUNLocode}</p></div>
                            <div className="rounded-lg border border-gray-200 bg-white p-4"><p className="mb-1 text-[9px] uppercase tracking-widest text-gray-400">GeoRisk match</p><p className="text-[12px] font-medium text-black">{matchedGeoRiskLane ? "Matched" : "Awaiting data"}</p></div>
                        </div>
                    )}
                    {/* Main Feed - Single Card View */}
                    <div className="pb-4 max-w-5xl mx-auto">
                        {lanes.length > 0 ? (
                            (() => {
                                const selectedLane = lanes[0];
                                return (
                                    <div key={selectedLane.id}>
                                        <MaerskPortVerification
                                            origin={selectedLane.origin_port?.name || "Unknown origin"}
                                            destination={selectedLane.destination_port?.name || "Unknown destination"}
                                            originUNLocode={selectedLane.origin_port.unlocode}
                                            destinationUNLocode={selectedLane.destination_port.unlocode}
                                        />
                                        <GeoRiskNavigator
                                            route={`${selectedLane.origin_port?.name} → ${selectedLane.destination_port?.name}`}
                                            data={getGeoRiskDataForLane()}
                                        />
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="py-16 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                <div className="mx-auto w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 border border-gray-200">
                                    <Ship className="h-5 w-5 text-gray-400" />
                                </div>
                                <h3 className="text-gray-600 font-normal text-[14px] mb-1">{workspaceLane === undefined ? "Loading lane…" : "Trade lane unavailable"}</h3>
                                <p className="text-gray-400 text-[12px]">Return to Trade Lanes and select a valid workspace.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}