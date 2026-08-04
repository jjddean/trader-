/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
"use client";

import { useEffect, useState } from "react";
import { RiskMap } from "@/components/georisk/maps/RiskMap";

export default function GlobalMapPage() {
    const [lanes, setLanes] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                const [lanesRes, scoresRes] = await Promise.all([
                    fetch("/api/georisk/lanes", { signal: controller.signal }),
                    fetch("/api/georisk/risk-scores", { signal: controller.signal })
                ]);
                if (!lanesRes.ok || !scoresRes.ok) throw new Error("GeoRisk API offline");
                setLanes(await lanesRes.json());
                setScores(await scoresRes.json());
            } catch {
                if (controller.signal.aborted) return;
                setLanes([]);
                setScores([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void fetchData();
        return () => controller.abort();
    }, []);

    return (
        <div className="flex h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">

            {/* Main Map View */}
            <main className="flex-1 flex flex-col relative overflow-hidden">
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Global Risk Intelligence Map</h1>
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-50 text-purple-600 border border-purple-200 font-normal tracking-wide animate-pulse">
                            SPATIAL INTEL
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-100 rounded-full">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                            <span className="text-[10px] text-green-700 font-medium">Real-time Feed Active</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-4 bg-gray-50">
                    {loading ? (
                        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200 rounded-xl">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin" />
                                <p className="text-xs text-gray-500">Initializing Spatial Engine...</p>
                            </div>
                        </div>
                    ) : (
                        <RiskMap lanes={lanes} scores={scores} />
                    )}
                </div>
            </main>
        </div>
    );
}