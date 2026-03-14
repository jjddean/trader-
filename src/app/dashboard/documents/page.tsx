"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  Globe,
  Package,
  Info,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// DCTS Countries for the dropdown
const DCTS_COUNTRIES: Record<string, string[]> = {
  Comprehensive: [
    "Afghanistan",
    "Angola",
    "Bangladesh",
    "Benin",
    "Bhutan",
    "Burkina Faso",
    "Burundi",
    "Cambodia",
    "Central African Republic",
    "Chad",
    "Comoros",
    "Democratic Republic of Congo",
    "Djibouti",
    "Eritrea",
    "Ethiopia",
    "Gambia",
    "Guinea",
    "Guinea-Bissau",
    "Haiti",
    "Kiribati",
    "Laos",
    "Lesotho",
    "Liberia",
    "Madagascar",
    "Malawi",
    "Mali",
    "Mauritania",
    "Mozambique",
    "Myanmar",
    "Nepal",
    "Niger",
    "Rwanda",
    "Senegal",
    "Sierra Leone",
    "Solomon Islands",
    "Somalia",
    "South Sudan",
    "Sudan",
    "Tanzania",
    "Timor-Leste",
    "Togo",
    "Tuvalu",
    "Uganda",
    "Vanuatu",
    "Yemen",
    "Zambia",
  ],
  Enhanced: [
    "Armenia",
    "Bolivia",
    "Cape Verde",
    "Kyrgyzstan",
    "Mongolia",
    "Pakistan",
    "Philippines",
    "Sri Lanka",
    "Tajikistan",
    "Uzbekistan",
    "Vietnam",
  ],
  Standard: [
    "Algeria",
    "Congo",
    "Cook Islands",
    "India",
    "Indonesia",
    "Micronesia",
    "Nigeria",
    "Niue",
    "Samoa",
    "Syria",
  ],
};

const ALL_COUNTRIES = [
  ...DCTS_COUNTRIES.Comprehensive,
  ...DCTS_COUNTRIES.Enhanced,
  ...DCTS_COUNTRIES.Standard,
].sort();

export default function DocumentsPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  // Convex queries
  type Lane = {
    _id: string;
    originCountry: string;
    commodityCode: string;
    description: string;
    tier: string;
    status: string;
    savingsEstimate?: number;
  };
  const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip") as unknown as
    | Lane[]
    | undefined;
  const dLanes = lanes ?? [];
  const isLoading = lanes === undefined;

  // Eligibility Check state
  const [selectedCountry, setSelectedCountry] = useState("");
  const eligibility = useQuery(
    api.compliance.checkEligibility,
    selectedCountry ? { originCountry: selectedCountry } : "skip",
  );

  // RoO Simulation state
  const simulateRoO = useMutation(api.compliance.simulateRoO);
  const [rooForm, setRooForm] = useState({
    originCountry: "",
    commodityCode: "",
    valueOrigin: "",
    valueUK: "",
    valueThirdParty: "",
  });
  type RooResult = {
    isCompliant: boolean;
    valueAddedPercent: number;
    threshold: number;
    message: string;
    cumulationApplied?: boolean;
  };
  const [rooResult, setRooResult] = useState<RooResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Landed Cost Calculator state
  const calculateLandedCost = useMutation(api.calculator.calculateLandedCost);
  const [calcForm, setCalcForm] = useState({
    hsCode: "",
    originCountry: "",
    itemValue: "",
    shippingCost: "",
    dutyRate: "",
    vatRate: "20",
  });
  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleSimulate = async () => {
    if (!rooForm.originCountry || !rooForm.commodityCode) return;
    setSimulating(true);
    try {
      const result = await simulateRoO({
        originCountry: rooForm.originCountry,
        commodityCode: rooForm.commodityCode,
        valueOrigin: parseFloat(rooForm.valueOrigin) || 0,
        valueUK: parseFloat(rooForm.valueUK) || 0,
        valueThirdParty: parseFloat(rooForm.valueThirdParty) || 0,
      });
      setRooResult(result);
    } finally {
      setSimulating(false);
    }
  };

  const handleCalculate = async () => {
    if (!calcForm.hsCode || !calcForm.originCountry || !calcForm.itemValue) return;
    setCalculating(true);
    try {
      const res = await calculateLandedCost({
        hsCode: calcForm.hsCode,
        originCountry: calcForm.originCountry,
        itemValue: parseFloat(calcForm.itemValue) || 0,
        shippingCost: parseFloat(calcForm.shippingCost) || 0,
        dutyRate: parseFloat(calcForm.dutyRate) || 0,
        vatRate: parseFloat(calcForm.vatRate) || 20,
      });
      setCalcResult(res);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Active Lanes
          </p>
          <h2 className="text-2xl font-normal text-black tabular-nums">
            <span style={{ display: "inline-block", width: "4ch" }}>
              {isLoading && dLanes.length === 0 ? "" : dLanes.length}
            </span>
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-400">Trade lanes under monitoring</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Verified
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-normal text-black tabular-nums">
              <span style={{ display: "inline-block", width: "4ch" }}>
                {isLoading && dLanes.length === 0
                  ? ""
                  : dLanes.filter((l) => l.status === "Verified").length}
              </span>
            </h2>
            <span className="text-[0.625rem] font-medium text-green-500">Compliant</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Under Review
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-normal text-black tabular-nums">
              <span style={{ display: "inline-block", width: "4ch" }}>
                {isLoading && dLanes.length === 0
                  ? ""
                  : dLanes.filter((l) => l.status === "Review").length}
              </span>
            </h2>
            <span className="text-[0.625rem] font-medium text-orange-500">Needs Attention</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-1 text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
            Est. Savings
          </p>
          <h2 className="text-2xl font-normal text-black tabular-nums">
            <span style={{ display: "inline-block", width: "6ch" }}>
              {isLoading && dLanes.length === 0
                ? ""
                : `£${(dLanes.reduce((acc, l) => acc + (l.savingsEstimate || 0), 0) / 1000).toFixed(0)}k`}
            </span>
          </h2>
          <p className="mt-1 text-[0.625rem] text-gray-400">Across all DCTS lanes</p>
        </div>
      </div>

      {/* Two-Column: Eligibility Check + RoO Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: DCTS Eligibility Checker */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-4">
            <Globe className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">DCTS Eligibility Check</h3>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Origin Country
              </label>
              <Select
                value={selectedCountry || undefined}
                onValueChange={(val) => setSelectedCountry(val || "")}
              >
                <SelectTrigger className="h-9 w-full border-gray-200 bg-gray-50 text-xs text-gray-700">
                  <SelectValue placeholder="Select a country..." />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {Object.entries(DCTS_COUNTRIES).flatMap(([tier, countries]) => [
                    ...countries.sort().map((c) => (
                      <SelectItem key={`${tier}-${c}`} value={c} className="text-xs">
                        {c}
                      </SelectItem>
                    )),
                  ])}
                </SelectContent>
              </Select>
            </div>

            {eligibility && (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  eligibility.eligible
                    ? "border-green-200 bg-green-50/50"
                    : "border-red-200 bg-red-50/50",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  {eligibility.eligible ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      eligibility.eligible ? "text-green-700" : "text-red-700",
                    )}
                  >
                    {eligibility.eligible ? "DCTS Eligible" : "Not Eligible"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[0.6875rem]">
                    <span className="text-gray-500">Tier</span>
                    <span className="font-medium text-black">{eligibility.tier}</span>
                  </div>
                  <div className="flex justify-between text-[0.6875rem]">
                    <span className="text-gray-500">Duty Rate</span>
                    <span className="font-medium text-black">{eligibility.duty}</span>
                  </div>
                  <div className="flex justify-between text-[0.6875rem]">
                    <span className="text-gray-500">Confidence</span>
                    <span className="font-medium text-black">
                      {(eligibility.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Document Generation */}
            {eligibility?.eligible && (
              <div className="space-y-2 pt-2">
                <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Available Documents
                </p>
                {[
                  { name: "Form A — Certificate of Origin", status: "ready" },
                  { name: "DCTS Preference Declaration", status: "ready" },
                  { name: "Rules of Origin Statement", status: "pending" },
                ].map((doc) => (
                  <button
                    key={doc.name}
                    className="group flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[0.6875rem] text-gray-700">{doc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[0.5625rem] font-medium tracking-wider uppercase",
                          doc.status === "ready"
                            ? "bg-green-100 text-green-600"
                            : "bg-orange-100 text-orange-600",
                        )}
                      >
                        {doc.status}
                      </span>
                      <Download className="h-3 w-3 text-gray-300 transition-colors group-hover:text-gray-500" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Rules of Origin Simulator */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-4">
            <Package className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Rules of Origin Simulator</h3>
          </div>
          <div className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Origin Country
                </label>
                <Select
                  value={rooForm.originCountry || undefined}
                  onValueChange={(val) => setRooForm((f) => ({ ...f, originCountry: val || "" }))}
                >
                  <SelectTrigger className="h-9 w-full border-gray-200 bg-gray-50 text-xs text-gray-700">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px]">
                    {Object.entries(DCTS_COUNTRIES).flatMap(([tier, countries]) => [
                      ...countries.sort().map((c) => (
                        <SelectItem key={`${tier}-${c}`} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      )),
                    ])}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  HS Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. 6109"
                  value={rooForm.commodityCode}
                  onChange={(e) => setRooForm((f) => ({ ...f, commodityCode: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Origin Value (£)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={rooForm.valueOrigin}
                  onChange={(e) => setRooForm((f) => ({ ...f, valueOrigin: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  UK Value (£)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={rooForm.valueUK}
                  onChange={(e) => setRooForm((f) => ({ ...f, valueUK: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                  Third Party (£)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={rooForm.valueThirdParty}
                  onChange={(e) => setRooForm((f) => ({ ...f, valueThirdParty: e.target.value }))}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={!rooForm.originCountry || !rooForm.commodityCode || simulating}
              className="h-8 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {simulating ? "Simulating..." : "Run RoO Simulation"}
            </button>

            {/* Simulation Result */}
            {rooResult && (
              <div
                className={cn(
                  "rounded-lg border p-4",
                  rooResult.isCompliant
                    ? "border-green-200 bg-green-50/50"
                    : "border-red-200 bg-red-50/50",
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  {rooResult.isCompliant ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      rooResult.isCompliant ? "text-green-700" : "text-red-700",
                    )}
                  >
                    {rooResult.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                  </span>
                </div>

                {/* Value Added Bar */}
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[0.625rem]">
                    <span className="text-gray-500">Value Added</span>
                    <span className="font-medium text-black">
                      {rooResult.valueAddedPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={cn(
                        "h-1.5 rounded-full transition-all",
                        rooResult.isCompliant ? "bg-green-500" : "bg-red-500",
                      )}
                      style={{ width: `${Math.min(rooResult.valueAddedPercent, 100)}%` }}
                    />
                  </div>
                  <div className="mt-0.5 flex justify-between text-[0.5625rem]">
                    <span className="text-gray-300">0%</span>
                    <span className="font-medium text-gray-400">
                      Threshold: {rooResult.threshold}%
                    </span>
                    <span className="text-gray-300">100%</span>
                  </div>
                </div>

                <p className="text-[0.6875rem] leading-relaxed text-gray-600">
                  {rooResult.message}
                </p>

                {rooResult.cumulationApplied && (
                  <div className="mt-2 flex items-center gap-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-1 text-[0.625rem] text-blue-600">
                    <span className="flex items-center gap-1.5"><Info className="h-3 w-3" />Regional cumulation rules applied</span>
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>

      {/* Full-width Bottom: Landed Cost Calculator */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-4">
          <Calculator className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Landed Cost Calculator</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Origin Country
                  </label>
                  <Select
                    value={calcForm.originCountry || undefined}
                    onValueChange={(val) => setCalcForm((f) => ({ ...f, originCountry: val || "" }))}
                  >
                    <SelectTrigger className="h-9 w-full border-gray-200 bg-gray-50 text-xs text-gray-700">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[300px]">
                      {ALL_COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    HS Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 6109"
                    value={calcForm.hsCode}
                    onChange={(e) => setCalcForm((f) => ({ ...f, hsCode: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Item Value (£)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={calcForm.itemValue}
                    onChange={(e) => setCalcForm((f) => ({ ...f, itemValue: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Shipping (£)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={calcForm.shippingCost}
                    onChange={(e) => setCalcForm((f) => ({ ...f, shippingCost: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Duty Rate (%)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={calcForm.dutyRate}
                    onChange={(e) => setCalcForm((f) => ({ ...f, dutyRate: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={calcForm.vatRate}
                    onChange={(e) => setCalcForm((f) => ({ ...f, vatRate: e.target.value }))}
                    className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleCalculate}
                disabled={!calcForm.hsCode || !calcForm.originCountry || !calcForm.itemValue || calculating}
                className="h-9 w-full rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {calculating ? "Calculating..." : "Calculate Landed Cost"}
              </button>
            </div>

            {/* Result Display */}
            <div>
              {calcResult ? (
                <div className="h-full space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-6">
                  <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Landed Cost Breakdown
                  </p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-[0.625rem] text-gray-400">CIF Value</p>
                      <p className="text-lg font-normal text-black">
                        £{(calcResult.cifValue || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.625rem] text-gray-400">Total Duty</p>
                      <p className="text-lg font-normal text-black">
                        £{(calcResult.dutyAmount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[0.625rem] text-gray-400">Total VAT</p>
                      <p className="text-lg font-normal text-black">
                        £{(calcResult.vatAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                      Final Landed Price
                    </p>
                    <p className="text-3xl font-normal text-black">
                      £{(calcResult.totalLandedCost || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                  <Calculator className="mb-2 h-8 w-8 text-gray-200" />
                  <p className="text-xs text-gray-400">
                    Enter details on the left to see the landed cost breakdown.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
