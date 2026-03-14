"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  CheckCircle2,
  Globe,
  Loader2,
  ArrowLeft,
  Mail,
  Phone,
  History,
  Info,
  Building2,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function ProspectProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as Id<"prospects">;

  const lead = useQuery(api.leads.getLead, { id });
  const [activeTab, setActiveTab] = useState("overview");

  if (!lead) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header with Navigation */}
      <div className="flex items-center justify-between gap-6 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:border-gray-400 hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h3 className="text-base font-medium text-black">
              {lead.companyName}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="bg-blue-50 text-[10px] text-blue-600 font-bold uppercase tracking-tight">
                {lead.status}
              </Badge>
              <div className="flex items-center gap-1.5 text-[0.6875rem] text-gray-500">
                <Globe className="h-3 w-3" />
                {lead.country}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
             <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">Reliability</p>
             <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full bg-green-500"
                    style={{ width: `${lead.reliabilityScore * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700">
                  {(lead.reliabilityScore * 100).toFixed(0)}%
                </span>
             </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-1">
             <Building2 className="h-3 w-3 text-gray-400" />
             <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">Category</p>
          </div>
          <p className="text-sm font-normal text-black">{lead.businessCategory || "General Trade"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-1">
             <Info className="h-3 w-3 text-gray-400" />
             <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">Primary HS</p>
          </div>
          <p className="text-sm font-normal font-mono text-black">{lead.primaryHS}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-1">
             <TrendingUp className="h-3 w-3 text-gray-400" />
             <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">DCTS Tier</p>
          </div>
          <p className="text-sm font-normal text-black">{lead.dctsTier}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-2 mb-1">
             <Mail className="h-3 w-3 text-gray-400" />
             <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">Active Channel</p>
          </div>
          <p className="text-sm font-normal text-black truncate">{lead.contactEmail || "No Email linked"}</p>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border border-gray-200 bg-white">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="shipments">Shipment History</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
           <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
             <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
               <div>
                  <h4 className="text-xs font-semibold text-black mb-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    Company Details
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Entity Name</span>
                      <span className="text-xs font-medium text-black">{lead.companyName}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Region</span>
                      <span className="text-xs font-medium text-black">{lead.country}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Primary HS</span>
                      <span className="text-xs font-mono font-medium text-black">{lead.primaryHS}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Business Class</span>
                      <span className="text-xs font-medium text-black">{lead.businessCategory}</span>
                    </div>
                  </div>
               </div>

               <div>
                  <h4 className="text-xs font-semibold text-black mb-4 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    Contact Information
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-gray-50 pb-2">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Email</span>
                      <span className="text-xs font-medium text-black">{lead.contactEmail || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[0.6875rem] text-gray-400 uppercase">Phone</span>
                      <span className="text-xs font-medium text-black">{lead.contactPhone || "N/A"}</span>
                    </div>
                  </div>
               </div>
             </div>

             <div className="rounded-xl border border-gray-200 bg-white p-6">
               <h4 className="text-xs font-semibold text-black mb-4 flex items-center gap-2">
                 <History className="h-4 w-4 text-gray-400" />
                 Engagement Log
               </h4>
               <div className="space-y-6">
                 <div className="flex gap-4">
                    <div className="h-2 w-2 rounded-full bg-green-500 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-black">Company Added to CRM</p>
                      <p className="text-[0.6875rem] text-gray-400 mt-1 leading-relaxed">
                        Prospect identified via Global Search and added to the pipeline.
                      </p>
                      <span className="text-[10px] text-gray-300 uppercase font-mono mt-2 block">
                        {lead.lastShipmentDate ? new Date(lead.lastShipmentDate).toLocaleDateString() : "Just now"}
                      </span>
                    </div>
                 </div>
                 {/* Placeholder for real timeline */}
                 <div className="flex gap-4">
                    <div className="h-2 w-2 rounded-full bg-gray-200 mt-1 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-400 italic">No outreach history yet</p>
                    </div>
                 </div>
               </div>
             </div>
           </div>
        </TabsContent>

        <TabsContent value="shipments" className="mt-4">
           <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-gray-50/50">
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">Date</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">HS Code</th>
                    <th className="px-6 py-3 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">Origin</th>
                    <th className="px-6 py-3 text-right text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">Value (£)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {lead.lastShipmentDate ? new Date(lead.lastShipmentDate).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-black">{lead.primaryHS}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">{lead.country}</td>
                    <td className="px-6 py-4 text-right text-xs font-medium text-black">£12,450</td>
                  </tr>
                  <tr className="bg-gray-50/30">
                    <td colSpan={4} className="px-6 py-3 text-center text-[0.625rem] text-gray-400 hover:text-gray-600 cursor-pointer">
                      LOAD MORE HISTORY
                    </td>
                  </tr>
               </tbody>
             </table>
           </div>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <h4 className="text-sm font-medium text-black">DCTS Verification Memo</h4>
              </div>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">COMPLIANT</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                     <p className="text-[0.625rem] tracking-widest text-gray-400 uppercase mb-1">Preference Scheme</p>
                     <p className="text-xs font-medium text-black">Developing Countries Trading Scheme ({lead.dctsTier})</p>
                  </div>
                  <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
                     <p className="text-[0.625rem] tracking-widest text-gray-400 uppercase mb-1">Origin Rule Applied</p>
                     <p className="text-xs font-medium text-black">Change in Tariff Subheading (CTSH)</p>
                  </div>
               </div>
               <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                     <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        <span className="text-[0.6875rem] font-bold text-blue-700 tracking-tight">ROO STATUS: VERIFIED</span>
                     </div>
                     <p className="text-[0.6875rem] text-gray-600 leading-relaxed">
                       Subject has demonstrated non-originating materials threshold of &lt; 40%. Full regional cumulation is available for this entity.
                     </p>
                  </div>
               </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
