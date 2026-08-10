"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";

import { api } from "../../../../../convex/_generated/api";

export default function TradeLaneDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const lane = useQuery(api.trade_lanes.get, { laneId: id });

  if (lane === undefined) return <div className="rounded-md border border-slate-200 bg-white p-6 text-xs text-slate-500">Loading trade lane…</div>;
  if (lane === null) return <div className="rounded-md border border-slate-200 bg-white p-6 text-xs text-slate-500">Trade lane not found.</div>;

  const fields = [
    ["Lane code", lane.code], ["Mode", lane.mode], ["Status", lane.status],
    ["Origin", lane.originName], ["Origin country", lane.originCountryCode], ["Origin UN/LOCODE", lane.originUNLocode],
    ["Destination", lane.destinationName], ["Destination country", lane.destinationCountryCode], ["Destination UN/LOCODE", lane.destinationUNLocode],
  ];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Lane Details</h2>
      <p className="mt-1 text-xs text-slate-500">Persisted route identifiers used by Maersk and GeoRisk.</p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        {fields.map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 bg-slate-50 p-3"><dt className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">{label}</dt><dd className="mt-1 text-xs font-medium capitalize text-slate-800">{value}</dd></div>)}
      </dl>
    </div>
  );
}