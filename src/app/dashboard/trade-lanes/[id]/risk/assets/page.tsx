"use client";

import { useMutation, useQuery } from "convex/react";
import { Radar, Save, Ship } from "lucide-react";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { api } from "../../../../../../../convex/_generated/api";

interface VesselReference {
  vesselName?: string;
  vesselIMONumber?: string;
  carrierVesselCode?: string;
  flagCode?: string;
  vesselType?: string;
}

function firstVessel(value: unknown): VesselReference | null {
  if (!Array.isArray(value) || typeof value[0] !== "object" || value[0] === null) return null;
  return value[0] as VesselReference;
}

export default function AssetsPage() {
  const { id } = useParams<{ id: string }>();
  const lane = useQuery(api.trade_lanes.get, { laneId: id });
  const setVesselImo = useMutation(api.trade_lanes.setVesselImo);
  const [imo, setImo] = useState<string | null>(null);
  const [vessel, setVessel] = useState<VesselReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!lane?.vesselImo) return () => controller.abort();
    void Promise.resolve().then(() => setLoading(true));
    void fetch(`/api/maersk/vessels?imo=${lane.vesselImo}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Maersk vessel lookup failed");
        return response.json();
      })
      .then((result) => { if (!controller.signal.aborted) setVessel(firstVessel(result)); })
      .catch(() => { if (!controller.signal.aborted) setVessel(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [lane?.vesselImo]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!lane) return;
    const vesselImo = imo ?? lane.vesselImo ?? "";
    if (vesselImo && !/^\d{7}$/.test(vesselImo)) {
      setMessage("IMO number must contain seven digits.");
      return;
    }
    setLoading(true);
    try {
      await setVesselImo({ laneId: lane._id, vesselImo: vesselImo || undefined });
      if (!vesselImo) setVessel(null);
      setMessage(vesselImo ? "Vessel linked to this lane." : "Vessel removed from this lane.");
    } catch {
      setMessage("The vessel could not be saved.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[520px] rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2"><Ship className="h-4 w-4 text-blue-600" /><h1 className="text-sm font-semibold text-slate-900">Lane vessel</h1></div>
      <p className="mt-1 text-xs text-slate-500">Link a seven-digit IMO number to enable verified maritime reference data.</p>

      <form onSubmit={save} className="mt-5 flex max-w-lg gap-2">
        <input value={imo ?? lane?.vesselImo ?? ""} onChange={(event) => setImo(event.target.value.replace(/\D/g, "").slice(0, 7))} placeholder="Seven-digit IMO number" inputMode="numeric" className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-xs outline-none focus:border-slate-400" />
        <button disabled={loading || !lane} className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs text-white disabled:opacity-50"><Save className="h-3.5 w-3.5" />Save</button>
      </form>
      {message && <p className="mt-2 text-[11px] text-slate-500">{message}</p>}

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        {loading ? <p className="text-xs text-slate-400">Loading vessel reference…</p> : vessel ? <div><p className="text-[10px] uppercase tracking-wide text-slate-400">Maersk reference data</p><p className="mt-1 text-sm font-medium text-slate-900">{vessel.vesselName || "Unnamed vessel"}</p><div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500"><span>IMO {vessel.vesselIMONumber || lane?.vesselImo}</span>{vessel.carrierVesselCode && <span>Carrier code {vessel.carrierVesselCode}</span>}{vessel.flagCode && <span>Flag {vessel.flagCode}</span>}{vessel.vesselType && <span>{vessel.vesselType}</span>}</div></div> : <p className="text-xs text-slate-400">No verified vessel is linked.</p>}
      </div>

      <div className="mt-4 flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4"><Radar className="h-4 w-4 shrink-0 text-amber-600" /><div><p className="text-xs font-medium text-amber-900">Live AIS positions are not connected</p><p className="mt-1 text-[11px] text-amber-800">Maersk provides vessel reference data here. A licensed AIS provider is still required for positions, course, speed and anomaly events.</p></div></div>
    </div>
  );
}