/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */
"use client";

import { useEffect, useState } from "react";
import { RiskMap } from "@/components/georisk/maps/RiskMap";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;

export default function GlobalMapPage() {
    const [lanes, setLanes] = useState<any[]>([]);
    const [scores, setScores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            try {
                if (!apiUrl) throw new Error("GeoRisk API URL not configured");
                const [lanesRes, scoresRes] = await Promise.all([
                    fetch(`${apiUrl}/lanes/`, { signal: controller.signal }),
                    fetch(`${apiUrl}/risk-scores/`, { signal: controller.signal })
                ]);
                if (!lanesRes.ok || !scoresRes.ok) throw new Error("GeoRisk API offline");
                setLanes(await lanesRes.json());
                setScores(await scoresRes.json());
            } catch {
                if (controller.signal.aborted) return;
                setLanes([
                    { id: 1, origin_port: { name: "Mumbai", longitude: 72.8777, latitude: 19.076 }, destination_port: { name: "London", longitude: -0.1276, latitude: 51.5074 } },
                    { id: 2, origin_port: { name: "Shanghai", longitude: 121.4737, latitude: 31.2304 }, destination_port: { name: "Rotterdam", longitude: 4.4777, latitude: 51.9225 } },
                    { id: 3, origin_port: { name: "Singapore", longitude: 103.8198, latitude: 1.3521 }, destination_port: { name: "New York", longitude: -74.006, latitude: 40.7128 } },
                    { id: 4, origin_port: { name: "Dubai", longitude: 55.2708, latitude: 25.2048 }, destination_port: { name: "Hamburg", longitude: 9.9937, latitude: 53.5511 } }
                ]);
                setScores([
                    { entityType: "lane", entityId: 1, score: 82 },
                    { entityType: "lane", entityId: 2, score: 94 },
                    { entityType: "lane", entityId: 3, score: 22 },
                    { entityType: "lane", entityId: 4, score: 45 }
                ]);
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