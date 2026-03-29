"use client";

import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { 
  Shield, 
  Settings, 
  Globe, 
  Zap, 
  ShieldCheck, 
  Activity, 
  Database, 
  ExternalLink,
  Server
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminSetupPage() {
  const { user } = useUser();
  const dbUser = useQuery(api.users.current);
  const [activeTab, setActiveTab] = useState<"system" | "organization" | "health">("system");

  const hmrcEnv = process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox";
  const eori = process.env.NEXT_PUBLIC_HMRC_EORI || "GB123456789000";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Platform Set Up</h1>
        <p className="text-sm text-gray-500">System-wide configuration and operational control plane.</p>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
        <button
          onClick={() => setActiveTab("system")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "system" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Server className="h-3.5 w-3.5" />
          System Config
        </button>
        <button
          onClick={() => setActiveTab("organization")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "organization" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Globe className="h-3.5 w-3.5" />
          Organization Master
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "health" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Activity className="h-3.5 w-3.5" />
          Service Health
        </button>
      </div>

      {activeTab === "system" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Settings className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Master Configuration</h3>
          </div>
          <div className="space-y-6 p-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  HMRC Environment
                </label>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                    hmrcEnv === "production" ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"
                  )}>
                    {hmrcEnv}
                  </span>
                  <p className="text-[11px] text-gray-400 italic">Controlled via .env.local</p>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  System EORI
                </label>
                <p className="font-mono text-xs font-semibold text-gray-900">{eori}</p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
              <div className="flex gap-3">
                <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-amber-900">Security Notice</h4>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Changes to the HMRC environment or Master EORI require a system restart. 
                    Ensure all tokens are refreshed in the new environment to avoid 401 Unauthorized rejections.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "organization" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Globe className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Company Identity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                    Legal Entity Name
                  </label>
                  <p className="text-xs text-black font-medium">FreightCode Ltd</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                    Company Number
                  </label>
                  <p className="text-xs text-black font-medium">12345678</p>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  CDS Status
                </label>
                <div className="flex items-center gap-2">
                   <ShieldCheck className="h-4 w-4 text-green-500" />
                   <span className="text-xs font-medium text-green-700">TDR Validated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HealthCard 
            title="Convex Database" 
            status="Healthy" 
            latency="14ms" 
            icon={<Database className="h-4 w-4" />} 
            color="green"
          />
          <HealthCard 
            title="HMRC API" 
            status="Degraded" 
            latency="1.2s" 
            icon={<Zap className="h-4 w-4" />} 
            color="amber"
          />
          <HealthCard 
            title="Clerk Auth" 
            status="Healthy" 
            latency="42ms" 
            icon={<ShieldCheck className="h-4 w-4" />} 
            color="green"
          />
          <HealthCard 
            title="Freight Assistant (AI)" 
            status="Healthy" 
            latency="850ms" 
            icon={<Activity className="h-4 w-4" />} 
            color="green"
          />
        </div>
      )}
    </div>
  );
}

function HealthCard({ title, status, latency, icon, color }: { title: string; status: string; latency: string; icon: React.ReactNode; color: "green" | "amber" | "red" }) {
  const colorMap = {
    green: "bg-green-50 text-green-700 border-green-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };
  const dotMap = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="text-gray-400">{icon}</div>
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            {title}
          </p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold uppercase", colorMap[color])}>
           <div className={cn("h-1.5 w-1.5 rounded-full", dotMap[color])} />
           {status}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">{latency}</span>
        <span className="text-[10px] text-gray-400 font-medium">LATENCY</span>
      </div>
    </div>
  );
}
