"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { ShieldCheck, Users, Calculator, ArrowUpRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
// no skeletons; use fixed-width number boxes instead

type Lane = {
  _id: string;
  originCountry: string;
  commodityCode: string;
  tier: string;
  status: string;
  savingsEstimate?: number;
};
type Lead = {
  _id: string;
  companyName: string;
  country: string;
  primaryHS: string;
  status: string;
};

export default function DashboardPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip");
  const leads = useQuery(api.leads.listLeads, {});

  const lanesLoaded = Array.isArray(lanes);
  const leadsLoaded = Array.isArray(leads);

  const dLanes = lanesLoaded ? (lanes as unknown as Lane[]) : [];
  const dLeads = leadsLoaded ? (leads as unknown as Lead[]) : [];

  const lanesLoading = lanes === undefined;
  const leadsLoading = leads === undefined;
  const isLoadingMetrics = lanesLoading || leadsLoading;

  const verifiedLanes = dLanes.filter((l: Lane) => l.status === "Verified").length ?? 0;
  const totalSavings =
    dLanes.reduce((acc: number, l: Lane) => acc + (l.savingsEstimate || 0), 0) ?? 0;
  const newLeads = dLeads.filter((l: Lead) => l.status === "New").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Trade Lanes
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-normal text-black tabular-nums">
              <span style={{ display: "inline-block", width: "4ch" }}>
                {isLoadingMetrics && dLanes.length === 0 ? "" : dLanes.length}
              </span>
            </h2>
            <span className="flex items-center text-[0.625rem] font-medium text-green-500">
              <span className="tabular-nums" style={{ display: "inline-block", width: "3ch" }}>
                {isLoadingMetrics && dLanes.length === 0 ? "" : verifiedLanes}
              </span>{" "}
              verified <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-400">Active DCTS corridors</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Prospects
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-normal text-black tabular-nums">
              <span style={{ display: "inline-block", width: "4ch" }}>
                {isLoadingMetrics && dLeads.length === 0 ? "" : dLeads.length}
              </span>
            </h2>
            <span className="text-[0.625rem] font-medium text-blue-500">
              <span className="tabular-nums" style={{ display: "inline-block", width: "3ch" }}>
                {isLoadingMetrics && dLeads.length === 0 ? "" : newLeads}
              </span>{" "}
              new
            </span>
          </div>
          <p className="mt-1 text-[0.625rem] text-gray-400">Partner pipeline</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Est. Savings
          </p>
          <h2 className="text-2xl font-normal text-black tabular-nums">
            <span style={{ display: "inline-block", width: "6ch" }}>
              {isLoadingMetrics && dLanes.length === 0
                ? ""
                : `£${(totalSavings / 1000).toFixed(0)}k`}
            </span>
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-400">DCTS duty relief</p>
        </div>

      </div>

      {/* Two Columns: Recent Lanes + Recent Prospects */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Trade Lanes */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-black">Recent Trade Lanes</h3>
            </div>
            <span
              className="text-[0.625rem] text-gray-400 tabular-nums"
              style={{ display: "inline-block", width: "6ch", textAlign: "right" }}
            >
              {lanesLoading ? "" : `${dLanes.length} total`}
            </span>
          </div>
          <div className="min-h-[240px]">
            {dLanes.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {dLanes.slice(0, 5).map((lane: Lane) => (
                  <div
                    key={lane._id}
                    className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-gray-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-3.5 w-3.5 text-gray-400" />
                      <div>
                        <p className="text-xs font-medium text-black">{lane.originCountry}</p>
                        <p className="text-[0.625rem] text-gray-400">
                          {lane.commodityCode} · {lane.tier}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          lane.status === "Verified"
                            ? "bg-green-500"
                            : lane.status === "Review"
                              ? "bg-orange-500"
                              : "bg-red-500",
                        )}
                      />
                      <span className="text-[0.625rem] text-gray-500">{lane.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-gray-300" />
                <p className="text-xs text-gray-400">
                  {lanesLoading ? "Loading trade lanes..." : "No trade lanes yet"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Prospects */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-black">Recent Prospects</h3>
            </div>
            <span
              className="text-[0.625rem] text-gray-400 tabular-nums"
              style={{ display: "inline-block", width: "6ch", textAlign: "right" }}
            >
              {leadsLoading ? "" : `${dLeads.length} total`}
            </span>
          </div>
          <div className="min-h-[240px]">
            {dLeads.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {dLeads.slice(0, 5).map((lead: Lead) => (
                  <div
                    key={lead._id}
                    className="flex items-center justify-between px-6 py-3 transition-colors hover:bg-gray-50/50"
                  >
                    <div>
                      <p className="text-xs font-medium text-black">{lead.companyName}</p>
                      <p className="text-[0.625rem] text-gray-400">
                        {lead.country} · HS {lead.primaryHS}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider uppercase",
                        lead.status === "New"
                          ? "bg-blue-100 text-blue-600"
                          : lead.status === "Contacted"
                            ? "bg-orange-100 text-orange-600"
                            : lead.status === "Client"
                              ? "bg-green-100 text-green-600"
                              : "bg-gray-100 text-gray-600",
                      )}
                    >
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-2 h-5 w-5 text-gray-300" />
                <p className="text-xs text-gray-400">
                  {leadsLoading ? "Loading prospects..." : "No prospects yet"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
