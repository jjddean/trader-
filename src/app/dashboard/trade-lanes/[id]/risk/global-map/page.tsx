"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

import { api } from "../../../../../../../convex/_generated/api";
import { RiskMap } from "@/components/georisk/maps/RiskMap";
import {
  findGeoRiskLane,
  type GeoRiskLane,
  type GeoRiskScore,
  normalizeGeoRiskScore,
} from "@/lib/georisk-data";

export default function GlobalMapPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceLane = useQuery(api.trade_lanes.get, { laneId: id });
  const [lanes, setLanes] = useState<GeoRiskLane[]>([]);
  const [scores, setScores] = useState<GeoRiskScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    if (!workspaceLane) return () => controller.abort();

    const fetchData = async () => {
      setLoading(true);
      try {
        const [lanesRes, scoresRes] = await Promise.all([
          fetch("/api/georisk/lanes", { signal: controller.signal }),
          fetch("/api/georisk/risk-scores", { signal: controller.signal }),
        ]);
        if (!lanesRes.ok || !scoresRes.ok) throw new Error("GeoRisk API offline");

        const availableLanes = (await lanesRes.json()) as GeoRiskLane[];
        const matchedLane = findGeoRiskLane(
          availableLanes,
          workspaceLane.originUNLocode,
          workspaceLane.destinationUNLocode,
        );
        const rawScores = (await scoresRes.json()) as Record<string, unknown>[];
        setLanes(matchedLane ? [matchedLane] : []);
        setScores(rawScores.map(normalizeGeoRiskScore));
      } catch {
        if (!controller.signal.aborted) {
          setLanes([]);
          setScores([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void fetchData();
    return () => controller.abort();
  }, [workspaceLane]);

  return (
    <div className="flex h-[680px] overflow-hidden rounded-lg border border-slate-200 bg-white font-sans text-gray-600">
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <header className="z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h1 className="text-[14px] font-normal tracking-tight text-black">Lane Risk Map</h1>
          <span className="rounded border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[9px] font-normal tracking-wide text-purple-600">
            SPATIAL INTEL
          </span>
        </header>

        <div className="flex-1 bg-gray-50 p-4">
          {loading || workspaceLane === undefined ? (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-gray-200 bg-white">
              <p className="text-[12px] text-gray-500">Loading lane spatial data…</p>
            </div>
          ) : lanes.length > 0 ? (
            <RiskMap lanes={lanes} scores={scores} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-6 text-center">
              <div>
                <p className="text-[13px] font-medium text-slate-700">Spatial route data unavailable</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  GeoRisk has no route matching this lane&apos;s UN/LOCODE pair yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}