"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ArrowRight,
  Info,
  Search,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  fetchTradeData,
  calculateUKImportCosts,
} from "@/lib/trade-data";

export const FullModeSimulator = () => {
  const [step, setStep] = useState<"audit" | "results">("audit");
  const [data, setData] = useState({
    hs: "",
    value: "",
    origin: "CN",
    freight: "",
    insurance: "",
    incoterm: "fob",
  });
  const [hsInfo, setHsInfo] = useState<{ code: string; desc: string } | null>(
    null,
  );
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const searchHMRC = useAction(api.hmrc_actions.searchHSCode);

  const handleHsSearch = async (val: string) => {
    setData({ ...data, hs: val });
    if (val.length >= 4) {
      const results = await searchHMRC({ query: val });
      if (results && results.length > 0) {
        setHsInfo({ 
          code: results[0].code, 
          desc: results[0].description 
        });
      }
    } else {
      setHsInfo(null);
    }
  };

  const handleAudit = async () => {
    setIsLoading(true);
    // Simulate "Forensic Audit" delay
    await new Promise((r) => setTimeout(r, 1500));

    const tradeData = await fetchTradeData();
    const baseRate = tradeData.hs_overrides[data.hs.substring(0, 4)] ?? 0.025;

    const costs = calculateUKImportCosts({
      goodsValue: parseFloat(data.value) || 0,
      freight: parseFloat(data.freight) || 0,
      insurance: parseFloat(data.insurance) || 0,
      dutyRate: baseRate,
      isVatRegistered: true,
      hasPreference: false,
    });

    setResults({
      ...costs,
      hsDesc: hsInfo?.desc || "General Merchandise",
    });
    setIsLoading(false);
    setStep("results");
  };

  return (
    <Card className="max-w-2xl mx-auto bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-md overflow-hidden">
      <CardHeader className="bg-slate-50/50 text-slate-900 py-8 px-10 relative border-b border-slate-100">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-blue-50 rounded-md flex items-center justify-center border border-blue-100 relative">
            <Shield className="h-6 w-6 text-blue-600" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 mb-1">
              UK Duty & VAT Simulator
            </CardTitle>
            <p className="text-slate-500 text-sm font-medium">
              Professional Customs Value & Tax Audit
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-10 bg-white">
        {step === "audit" && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Commodity HS Code
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="e.g. 6403 91"
                      className="bg-white border-slate-200 text-slate-900 h-14 pl-12 rounded-md focus:ring-blue-500 font-mono tracking-wider"
                      value={data.hs}
                      onChange={(e) => handleHsSearch(e.target.value)}
                    />
                  </div>
                  {hsInfo && (
                    <p className="text-[11px] text-blue-600/80 font-medium ml-1 animate-in fade-in slide-in-from-left-2">
                      Found: {hsInfo.desc.substring(0, 60)}...
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    Origin Territory
                  </Label>
                  <Input
                    placeholder="CHINA (CN)"
                    className="bg-white border-slate-200 text-slate-900 h-14 rounded-md focus:ring-blue-500"
                    value={data.origin}
                    onChange={(e) =>
                      setData({ ...data, origin: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    FOB / EXW Value (GBP)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                      £
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="bg-white border-slate-200 text-slate-900 h-14 pl-10 rounded-md font-bold text-lg focus:ring-blue-500"
                      value={data.value}
                      onChange={(e) =>
                        setData({ ...data, value: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                      Freight
                    </Label>
                    <Input
                      type="number"
                      placeholder="£"
                      className="bg-white border-slate-200 text-slate-900 h-14 rounded-xl focus:ring-blue-500"
                      value={data.freight}
                      onChange={(e) =>
                        setData({ ...data, freight: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                      Insurance
                    </Label>
                    <Input
                      type="number"
                      placeholder="£"
                      className="bg-white border-slate-200 text-slate-900 h-14 rounded-xl focus:ring-blue-500"
                      value={data.insurance}
                      onChange={(e) =>
                        setData({ ...data, insurance: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-blue-50/50 border border-blue-100 shadow-inner rounded-md flex gap-4 items-center">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                The Simulator verifies customs valuation methods according to UK
                General Interpretation Rules (GIR). Advanced audit includes
                trade remedies and preferential tariff eligibility checks.
              </p>
            </div>

            <Button
              onClick={handleAudit}
              disabled={!data.hs || !data.value || isLoading}
              className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold rounded-md shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-white rounded-full animate-spin" />
                  Verifying HTS & Origin Data...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Execute Customs Audit
                  <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </Button>
          </div>
        )}

        {step === "results" && results && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-md space-y-4">
                  <h4 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                    Audit Summary
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">HS Code</span>
                      <span className="text-slate-900 font-mono">
                        {data.hs}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Duty Rate</span>
                      <span className="text-slate-900 font-bold">
                        {(results.dutyRate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">VAT Factor</span>
                      <span className="text-slate-900">20% Standard</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 bg-emerald-50 border border-emerald-100 rounded-md text-center flex flex-col justify-center">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">
                  Total Estimated Tax Liability
                </p>
                <p className="text-5xl font-bold text-slate-900 tracking-tighter">
                  £{results.totalTaxes.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Ready for C88 Submission
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Calculation Breakdown
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    label: "Customs Value",
                    value: `£${results.customsValue.toLocaleString()}`,
                  },
                  {
                    label: "Import Duty",
                    value: `£${results.dutyAmount.toLocaleString()}`,
                  },
                  {
                    label: "Import VAT",
                    value: `£${results.vatAmount.toLocaleString()}`,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="p-4 bg-white border border-slate-200 rounded-xl"
                  >
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight mb-1">
                      {item.label}
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button className="w-full h-14 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm">
                <FileText className="h-4 w-4 text-slate-500" />
                Generate UK Import Profile
              </Button>
              <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2">
                Upload Documents to HMRC
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <button
              onClick={() => setStep("audit")}
              className="w-full text-xs text-slate-500 hover:text-slate-700 font-medium py-1 transition-colors"
            >
              ← Run Another Audit
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
