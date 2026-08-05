"use client";

import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Filter, Plus, Search, Ship, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "../../../../convex/_generated/api";
import { cn } from "@/lib/utils";

const STATUS_FILTER_OPTIONS = ["all", "active", "draft", "inactive"] as const;

type LaneForm = {
  code: string;
  originName: string;
  originCountryCode: string;
  originUNLocode: string;
  destinationName: string;
  destinationCountryCode: string;
  destinationUNLocode: string;
  mode: "ocean" | "air" | "rail" | "road";
};

const EMPTY_FORM: LaneForm = {
  code: "",
  originName: "",
  originCountryCode: "",
  originUNLocode: "",
  destinationName: "",
  destinationCountryCode: "",
  destinationUNLocode: "",
  mode: "ocean",
};

export default function TradeLanesPage() {
  const router = useRouter();
  const lanes = useQuery(api.trade_lanes.list) ?? [];
  const createLane = useMutation(api.trade_lanes.create);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER_OPTIONS)[number]>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LaneForm>(EMPTY_FORM);

  const filteredLanes = lanes.filter((lane) => {
    if (statusFilter !== "all" && lane.status !== statusFilter) return false;
    const term = searchQuery.trim().toLowerCase();
    return !term || [lane.code, lane.originName, lane.destinationName, lane.originUNLocode, lane.destinationUNLocode, lane.mode, lane.status]
      .some((value) => value.toLowerCase().includes(term));
  });

  const submitLane = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const laneId = await createLane({
        ...form,
        status: "active",
        originCountryCode: form.originCountryCode.toUpperCase(),
        originUNLocode: form.originUNLocode.toUpperCase(),
        destinationCountryCode: form.destinationCountryCode.toUpperCase(),
        destinationUNLocode: form.destinationUNLocode.toUpperCase(),
      });
      setForm(EMPTY_FORM);
      setShowCreate(false);
      router.push(`/dashboard/trade-lanes/${laneId}`);
    } finally {
      setSaving(false);
    }
  };

  const field = (name: keyof LaneForm, label: string, placeholder: string, maxLength?: number) => (
    <label className="space-y-1">
      <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</span>
      <input
        required
        value={form[name]}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => setForm((current) => ({ ...current, [name]: event.target.value }))}
        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-400"
      />
    </label>
  );

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Trade Lanes</h1>
          <p className="mt-1 text-sm text-slate-500">Manage contracted carrier lanes and published rates.</p>
        </div>
        <button type="button" onClick={() => setShowCreate((open) => !open)} className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800">
          {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showCreate ? "Cancel" : "New Trade Lane"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={submitLane} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-4">
            {field("code", "Lane code", "INBOM-GBFXT")}
            {field("originName", "Origin", "Mumbai")}
            {field("originCountryCode", "Origin country", "IN", 2)}
            {field("originUNLocode", "Origin UN/LOCODE", "INBOM", 5)}
            {field("destinationName", "Destination", "Felixstowe")}
            {field("destinationCountryCode", "Destination country", "GB", 2)}
            {field("destinationUNLocode", "Destination UN/LOCODE", "GBFXT", 5)}
            <label className="space-y-1">
              <span className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">Mode</span>
              <select value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as LaneForm["mode"] }))} className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none">
                <option value="ocean">Ocean</option><option value="air">Air</option><option value="rail">Rail</option><option value="road">Road</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button disabled={saving} className="h-9 rounded-md bg-black px-4 text-xs font-medium text-white disabled:opacity-50">{saving ? "Creating…" : "Create Trade Lane"}</button>
          </div>
        </form>
      )}

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
        <div className="relative z-20 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input placeholder="Search by lane, port, UN/LOCODE, mode, or status..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs outline-none focus:border-slate-400" />
            </div>
            <div className="relative">
              <button type="button" onClick={() => setShowFilters((open) => !open)} className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600"><Filter className="h-3 w-3" />Filter</button>
              {showFilters && <div className="absolute right-0 top-10 z-30 w-40 rounded-md border border-slate-200 bg-white p-2 shadow-md">{STATUS_FILTER_OPTIONS.map((status) => <button key={status} onClick={() => { setStatusFilter(status); setShowFilters(false); }} className={cn("block w-full rounded px-2 py-1.5 text-left text-xs capitalize hover:bg-slate-100", statusFilter === status && "bg-slate-100 font-medium")}>{status}</button>)}</div>}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-slate-200"><th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase">Lane</th><th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase">Route</th><th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase">Mode</th><th className="px-6 py-3 text-[11px] font-semibold text-slate-500 uppercase">Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLanes.length === 0 ? <tr><td colSpan={5}><div className="flex flex-col items-center py-10 text-center"><Ship className="mb-3 h-5 w-5 text-slate-300" /><p className="text-sm font-semibold text-slate-900">No trade lanes yet</p><p className="mt-1 text-xs text-slate-500">Create a lane with verified port identifiers.</p></div></td></tr> : filteredLanes.map((lane) => (
                <tr key={lane._id} onClick={() => router.push(`/dashboard/trade-lanes/${lane._id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-6 py-4"><p className="text-xs font-semibold text-slate-900">{lane.code}</p><p className="mt-0.5 text-[10px] text-slate-500">{lane.originUNLocode} → {lane.destinationUNLocode}</p></td>
                  <td className="px-6 py-4 text-xs text-slate-600">{lane.originName} → {lane.destinationName}</td>
                  <td className="px-6 py-4 text-xs capitalize text-slate-600">{lane.mode}</td>
                  <td className="px-6 py-4"><span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium capitalize text-slate-700">{lane.status}</span></td>
                  <td className="px-6 py-4 text-right"><ArrowRight className="ml-auto h-4 w-4 text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}