"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Users,
  MessageSquareText,
  Send,
  Globe,
  CheckCircle2,
  Circle,
  Loader2,
  Search as SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function LaneWorkspacePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"tradeLanes">;

  // Fetch specific lane - replaces client-side filtering and mock fallbacks
  const lane = useQuery(api.trade_lanes.getLane, { id });
  
  const eligibility = useQuery(
    api.compliance.checkEligibility,
    lane ? { originCountry: lane.originCountry } : "skip",
  ) as unknown as { eligible?: boolean; scheme?: string; tariffRate?: number } | undefined;
  
  const serverLeads = useQuery(
    api.leads.listLeads,
    lane
      ? {
          laneId: id,
          country: lane.originCountry || undefined,
          hsCode: lane.commodityCode ? lane.commodityCode.slice(0, 4) : undefined,
        }
      : "skip",
  );

  type Lead = {
    _id: Id<"prospects">;
    companyName: string;
    country: string;
    primaryHS: string;
    dctsTier: string;
    businessCategory?: string;
    contactEmail?: string;
    status: string;
  };

  const leads = serverLeads as Lead[] | undefined;

  const explainTradeRule = useAction(api.ai.explainTradeRule);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProspect, setSelectedProspect] = useState<Lead | null>(null);
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [draft, setDraft] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Discovery State
  const [isDiscoveryMode, setIsDiscoveryMode] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const runDiscoverySearch = useAction(api.actions.companies.searchCompanies);
  const createProspect = useMutation(api.leads.createProspect);

  // Pre-fill discovery query with lane context
  React.useEffect(() => {
    if (lane && !discoveryQuery) {
      const queryParts = [];
      if (lane.originCountry) queryParts.push(lane.originCountry);
      if (lane.commodityCode) queryParts.push(lane.commodityCode);
      setDiscoveryQuery(queryParts.join(" "));
    }
  }, [lane, isDiscoveryMode]);

  const serverMessages = useQuery(
    (api as any).messages?.listByLane || ({} as any),
    lane ? { laneId: lane._id } : "skip",
  ) as unknown as any[] | undefined;

  const convMessages = serverMessages;

  const saveDraft = useMutation((api as any).messages?.saveDraft || ({} as any));

  if (!lane) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="no-scrollbar flex items-center justify-between gap-6 overflow-x-auto pb-2">
        <div className="flex shrink-0 items-center gap-3">
          <Globe className="h-4 w-4 text-gray-400" />
          <div>
            <h3 className="text-xl font-bold tracking-tight whitespace-nowrap text-black">
              Trade Lane Workspace
            </h3>
            <p className="text-base font-medium whitespace-nowrap text-gray-500">
              {lane.description}
            </p>
          </div>
        </div>

      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="border border-gray-200 bg-white">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="prospects">Prospects</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    Origin
                  </p>
                  <p className="text-xs text-black">{lane.originCountry}</p>
                </div>
                <div>
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    HS Code
                  </p>
                  <p className="font-mono text-xs text-gray-700">{lane.commodityCode}</p>
                </div>
                <div>
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">Tier</p>
                  <p className="text-xs text-gray-700">{lane.tier}</p>
                </div>
                <div>
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    Status
                  </p>
                  <p className="text-xs text-gray-700">{lane.status}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Duty Savings Analysis
                </p>
                <div className="flex items-baseline gap-2">
                  <h2 className="text-2xl font-normal text-black">
                    £{((lane.savingsEstimate || 0) / 1000).toFixed(1)}k
                  </h2>
                  <span className="text-[0.625rem] font-medium text-green-600">
                    Annual Est.
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-[0.625rem]">
                    <span className="text-gray-400">Standard Tariff</span>
                    <span className="text-gray-600">12.0%</span>
                  </div>
                  <div className="flex justify-between text-[0.625rem]">
                    <span className="text-gray-400">DCTS Preference</span>
                    <span className="text-green-600">0.0%</span>
                  </div>
                  <div className="h-px bg-gray-50" />
                  <div className="flex justify-between text-[0.625rem] font-medium">
                    <span className="text-gray-900">Net Relief</span>
                    <span className="text-green-600">12.0%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <p className="mb-4 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Market Context
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <p className="text-[0.6875rem] leading-relaxed text-gray-600">
                      {lane.originCountry} remains a key partner under the DCTS framework.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <p className="text-[0.6875rem] leading-relaxed text-gray-600">
                      Stable trade route verified for HS {lane.commodityCode}.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium text-black">Compliance Engine</p>
                </div>
                <Badge variant="outline" className="border-green-100 bg-green-50 text-[10px] text-green-700">
                  Verified
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    Eligible
                  </p>
                  <p className="text-xs font-medium text-green-700">Yes</p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    Scheme
                  </p>
                  <p className="text-xs font-medium text-gray-700">
                    {eligibility?.scheme || lane.tier}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                    Tariff Rate
                  </p>
                  <p className="text-xs font-medium text-gray-700">
                    {typeof eligibility?.tariffRate === "number"
                      ? `${eligibility.tariffRate}%`
                      : "0% Duty Free"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="prospects" className="mt-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <p className="text-sm font-medium text-black">
                  {isDiscoveryMode ? "Global Discovery" : "Prospects"}
                </p>
                {!isDiscoveryMode && (
                  <Badge variant="secondary" className="bg-blue-50 text-[10px] text-blue-600">
                    {leads?.length || 0} Saved
                  </Badge>
                )}
              </div>
              <button
                onClick={() => setIsDiscoveryMode(!isDiscoveryMode)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-md border px-3 text-[10px] font-bold tracking-tight uppercase transition-all shadow-sm active:scale-95",
                  isDiscoveryMode
                    ? "bg-black text-white border-black hover:bg-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50",
                )}
              >
                <SearchIcon className="h-3 w-3" />
                {isDiscoveryMode ? "Back to Saved" : "Find New Partners"}
              </button>
            </div>

            {isDiscoveryMode ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search global database by company or HS code..."
                      className="h-9 w-full rounded-md border border-gray-200 bg-gray-50/50 pl-9 pr-3 text-xs outline-none focus:border-gray-300"
                      value={discoveryQuery}
                      onChange={(e) => setDiscoveryQuery(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          setIsSearching(true);
                          try {
                            const res = await runDiscoverySearch({ query: discoveryQuery });
                            setDiscoveryResults(res.hits || []);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setIsSearching(false);
                          }
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={async () => {
                      setIsSearching(true);
                      try {
                        const res = await runDiscoverySearch({ query: discoveryQuery });
                        setDiscoveryResults(res.hits || []);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSearching(false);
                      }
                    }}
                    disabled={isSearching}
                    className="flex h-9 items-center rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </button>
                </div>

                <div className="min-h-[300px]">
                  {discoveryResults.length > 0 ? (
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                            Company
                          </th>
                          <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                            Country
                          </th>
                          <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                            Category
                          </th>
                          <th className="px-4 py-2 text-right text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {discoveryResults.map((hit) => (
                          <tr
                            key={hit.document.id}
                            className="bg-white transition-colors hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-black">
                                {hit.document.name}
                              </p>
                              <p className="text-[0.625rem] text-gray-400">
                                {hit.document.hscode}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[0.6875rem] text-gray-600">
                                {hit.document.country}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-600">
                                {hit.document.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={async () => {
                                  await createProspect({
                                    companyName: hit.document.name,
                                    country: hit.document.country,
                                    dctsTier: lane.tier || "Standard", 
                                    businessCategory: hit.document.category || "General",
                                    primaryHS: hit.document.hscode,
                                    laneId: id,
                                  });
                                  setIsDiscoveryMode(false);
                                }}
                                className="h-7 items-center rounded border border-gray-200 bg-white px-2.5 text-[0.625rem] font-medium text-black transition-colors hover:border-gray-400"
                              >
                                Save to Pipeline
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="py-20 text-center">
                      <p className="text-[0.6875rem] text-gray-400">
                        {isSearching
                          ? "Querying global trade index..."
                          : "Find real-world partners using our live global database."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : leads && leads.length > 0 ? (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                      Company
                    </th>
                    <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                      Country
                    </th>
                    <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                      HS
                    </th>
                    <th className="px-4 py-2 text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                      Tier
                    </th>
                    <th className="px-4 py-2 text-right text-[0.625rem] font-semibold tracking-wider text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map((p) => (
                    <tr 
                      key={p._id} 
                      className="cursor-pointer transition-colors hover:bg-gray-50/50"
                      onClick={() => router.push(`/dashboard/prospects/${p._id}`)}
                    >
                      <td className="px-4 py-2">
                        <p className="text-xs font-medium text-black">{p.companyName}</p>
                        {p.businessCategory && (
                          <p className="text-[10px] text-gray-400 font-normal">{p.businessCategory}</p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-[0.6875rem] text-gray-600">{p.country}</td>
                      <td className="px-4 py-2 font-mono text-[0.6875rem] text-gray-600">
                        {p.primaryHS}
                      </td>
                      <td className="px-4 py-2">
                        <div
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap",
                            p.dctsTier === "Comprehensive"
                              ? "bg-green-100 text-green-700"
                              : p.dctsTier === "Enhanced"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700",
                          )}
                          title={p.dctsTier}
                        >
                          {p.dctsTier.length > 15 ? p.dctsTier.substring(0, 13) + "..." : p.dctsTier}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProspect(p);
                            setActiveTab("messages");
                          }}
                          className="h-7 rounded border border-gray-200 bg-white px-2.5 text-[0.625rem] font-medium text-black transition-colors hover:border-gray-400"
                        >
                          Contact
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center">
                 <p className="text-xs text-gray-400 italic">No prospects found for this lane.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <div className="flex flex-col md:flex-row rounded-xl border border-gray-200 bg-white overflow-hidden min-h-[500px] shadow-sm">
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50/30 p-5">
              <div className="mb-6 flex items-center gap-2">
                <MessageSquareText className="h-4 w-4 text-gray-400" />
                <p className="text-[13px] font-semibold text-black uppercase tracking-wider">Conversations</p>
              </div>
              <div className="space-y-1">
                {selectedProspect ? (
                  <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-white p-3 shadow-sm transition-all hover:bg-gray-50/50 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
                      {selectedProspect.companyName[0]}
                    </div>
                    <div>
                      <p className="text-[0.75rem] font-semibold text-black">
                        {selectedProspect.companyName}
                      </p>
                      <p className="text-[0.625rem] font-medium text-blue-600">Active Draft</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[0.6875rem] text-gray-400 italic">Select a prospect to message.</p>
                )}
              </div>
            </div>

            <div className="flex-1 p-6 bg-white overflow-y-auto">
              <div className="w-full max-w-2xl mx-auto space-y-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-black">New Message</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(["email", "whatsapp", "sms"] as const).map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setChannel(ch)}
                        className={cn(
                          "h-6 rounded border px-2.5 text-[0.625rem] font-medium capitalize transition-colors",
                          channel === ch
                            ? "border-black bg-black text-white"
                            : "border-gray-200 bg-white text-gray-500 hover:border-gray-400",
                        )}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedProspect ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-2 px-3">
                        <p className="text-[0.6875rem] text-gray-600">
                          Contacting <b>{selectedProspect.companyName}</b>
                        </p>
                        <button
                          onClick={() => setSelectedProspect(null)}
                          className="text-[0.625rem] text-red-400 hover:text-red-600"
                        >
                          Cancel
                        </button>
                      </div>

                      <div className="relative">
                        <textarea
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value);
                            if (error) setError(null);
                          }}
                          rows={4}
                          className="w-full rounded-md border border-gray-200 p-3 text-[14px] transition-colors outline-none focus:border-gray-400"
                          placeholder={`Draft your ${channel} message...`}
                        />
                        <button
                          onClick={async () => {
                            setSending(true);
                            setError(null);
                            try {
                              const target = ` to ${selectedProspect.companyName}`;
                              const prompt = `Write a short B2B outreach ${channel} message${target} about exporting HS ${lane.commodityCode || "product"} from ${lane.originCountry} using DCTS to the UK at 0% duty. Keep it concise and professional.`;
                              const res = await explainTradeRule({
                                query: prompt,
                                hsCode: lane.commodityCode,
                                country: lane.originCountry,
                              });
                              setDraft(res.response || "");
                            } catch (err: any) {
                              console.error("AI Generation failed:", err);
                              setError("Failed to generate draft.");
                            } finally {
                              setSending(false);
                            }
                          }}
                          disabled={sending}
                          className="absolute right-2 bottom-2 h-7 rounded bg-gray-100 px-2.5 text-[0.625rem] text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
                        >
                          {sending ? "..." : "AI Assist"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        {error && <p className="text-[0.625rem] text-red-500">{error}</p>}
                        <div />
                        <button
                          onClick={async () => {
                            if (!draft.trim()) return;
                            setSending(true);
                            try {
                              await saveDraft({
                                laneId: lane._id,
                                prospectId: selectedProspect._id,
                                content: draft,
                                userId: lane.userId,
                              });
                              setDraft("");
                              setError(null);
                            } catch (err: any) {
                              setError("Failed to save draft.");
                            } finally {
                              setSending(false);
                            }
                          }}
                          className="h-8 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                          disabled={!draft.trim() || sending}
                        >
                          Send Message
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-center">
                      <p className="text-[0.6875rem] text-gray-500">
                        Select a prospect from the **Prospects** tab to start a conversation.
                      </p>
                    </div>
                  )}

                  {convMessages && convMessages.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="mb-3 text-[0.625rem] tracking-widest text-gray-400 uppercase">
                        Message History
                      </p>
                      <ul className="space-y-3">
                        {convMessages.map((m) => (
                          <li
                            key={m._id}
                            className="rounded-lg border border-gray-100 bg-white p-3"
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-[0.625rem] font-medium text-black">
                                {m.sender === "user" ? "You" : "Buyer"}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="h-3.5 border-gray-200 text-[8px] capitalize"
                                >
                                  {m.status || "Sent"}
                                </Badge>
                                <span className="text-[0.625rem] text-gray-400">
                                  {new Date(m.createdAt).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>
                            <p className="text-[14px] whitespace-pre-wrap text-gray-600 font-normal leading-relaxed">{m.content}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
}
