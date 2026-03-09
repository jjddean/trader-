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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxTrigger,
    ComboboxValue,
} from "@/components/ui/combobox";

// DCTS Countries for the dropdown
const DCTS_COUNTRIES: Record<string, string[]> = {
    Comprehensive: [
        "Afghanistan", "Angola", "Bangladesh", "Benin", "Bhutan", "Burkina Faso", "Burundi",
        "Cambodia", "Central African Republic", "Chad", "Comoros", "Democratic Republic of Congo",
        "Djibouti", "Eritrea", "Ethiopia", "Gambia", "Guinea", "Guinea-Bissau", "Haiti",
        "Kiribati", "Laos", "Lesotho", "Liberia", "Madagascar", "Malawi", "Mali",
        "Mauritania", "Mozambique", "Myanmar", "Nepal", "Niger", "Rwanda",
        "Senegal", "Sierra Leone", "Solomon Islands", "Somalia", "South Sudan", "Sudan",
        "Tanzania", "Timor-Leste", "Togo", "Tuvalu", "Uganda", "Vanuatu", "Yemen", "Zambia"
    ],
    Enhanced: [
        "Armenia", "Bolivia", "Cape Verde", "Kyrgyzstan", "Mongolia", "Pakistan",
        "Philippines", "Sri Lanka", "Tajikistan", "Uzbekistan", "Vietnam"
    ],
    Standard: [
        "Algeria", "Congo", "Cook Islands", "India", "Indonesia", "Micronesia",
        "Nigeria", "Niue", "Samoa", "Syria"
    ],
};

const ALL_COUNTRIES = [
    ...DCTS_COUNTRIES.Comprehensive,
    ...DCTS_COUNTRIES.Enhanced,
    ...DCTS_COUNTRIES.Standard,
].sort();

export default function CompliancePage() {
    const { user } = useUser();
    const userId = user?.id || "";

    // Convex queries
    const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip");

    // Eligibility Check state
    const [selectedCountry, setSelectedCountry] = useState("");
    const eligibility = useQuery(
        api.compliance.checkEligibility,
        selectedCountry ? { originCountry: selectedCountry } : "skip"
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

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">

            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest mb-1">Active Lanes</p>
                    <h2 className="text-2xl font-light text-black">{lanes?.length ?? "—"}</h2>
                    <p className="text-[0.625rem] text-gray-400 mt-1">Trade lanes under monitoring</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest mb-1">Verified</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-2xl font-light text-black">
                            {lanes?.filter(l => l.status === "Verified").length ?? "—"}
                        </h2>
                        <span className="text-[0.625rem] text-green-500 font-medium">Compliant</span>
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest mb-1">Under Review</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-2xl font-light text-black">
                            {lanes?.filter(l => l.status === "Review").length ?? "—"}
                        </h2>
                        <span className="text-[0.625rem] text-orange-500 font-medium">Needs Attention</span>
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest mb-1">Est. Savings</p>
                    <h2 className="text-2xl font-light text-black">
                        £{((lanes?.reduce((acc, l) => acc + (l.savingsEstimate || 0), 0) ?? 0) / 1000).toFixed(0)}k
                    </h2>
                    <p className="text-[0.625rem] text-gray-400 mt-1">Across all DCTS lanes</p>
                </div>
            </div>

            {/* Two-Column: Eligibility Check + RoO Simulator */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left: DCTS Eligibility Checker */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">DCTS Eligibility Check</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                Origin Country
                            </label>
                            <Combobox value={selectedCountry || undefined} onValueChange={(val: unknown) => setSelectedCountry(val as string)}>
                                <ComboboxTrigger className="w-full h-9 bg-gray-50 border-gray-200 text-xs text-gray-700">
                                    <ComboboxValue placeholder="Select a country..." />
                                </ComboboxTrigger>
                                <ComboboxContent className="max-h-60">
                                    <ComboboxInput placeholder="Search country..." />
                                    {Object.entries(DCTS_COUNTRIES).flatMap(([tier, countries]) => [
                                        ...countries.sort().map((c) => (
                                            <ComboboxItem key={`${tier}-${c}`} value={c} className="text-xs">{c}</ComboboxItem>
                                        )),
                                    ])}
                                </ComboboxContent>
                            </Combobox>
                        </div>

                        {eligibility && (
                            <div className={cn(
                                "p-4 rounded-lg border",
                                eligibility.eligible ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"
                            )}>
                                <div className="flex items-center gap-2 mb-2">
                                    {eligibility.eligible
                                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        : <XCircle className="h-4 w-4 text-red-600" />}
                                    <span className={cn(
                                        "text-xs font-semibold",
                                        eligibility.eligible ? "text-green-700" : "text-red-700"
                                    )}>
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
                                        <span className="font-medium text-black">{(eligibility.confidence * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Document Generation */}
                        {eligibility?.eligible && (
                            <div className="space-y-2 pt-2">
                                <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Available Documents</p>
                                {[
                                    { name: "Form A — Certificate of Origin", status: "ready" },
                                    { name: "DCTS Preference Declaration", status: "ready" },
                                    { name: "Rules of Origin Statement", status: "pending" },
                                ].map((doc) => (
                                    <button
                                        key={doc.name}
                                        className="w-full flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 transition-colors group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-3.5 w-3.5 text-gray-400" />
                                            <span className="text-[0.6875rem] text-gray-700">{doc.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-[0.5625rem] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
                                                doc.status === "ready" ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                                            )}>
                                                {doc.status}
                                            </span>
                                            <Download className="h-3 w-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Rules of Origin Simulator */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-white">
                        <Package className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">Rules of Origin Simulator</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                    Origin Country
                                </label>
                                <Combobox value={rooForm.originCountry || undefined} onValueChange={(val: unknown) => setRooForm(f => ({ ...f, originCountry: val as string }))}>
                                    <ComboboxTrigger className="w-full h-9 bg-gray-50 border-gray-200 text-xs text-gray-700">
                                        <ComboboxValue placeholder="Select..." />
                                    </ComboboxTrigger>
                                    <ComboboxContent className="max-h-60">
                                        <ComboboxInput placeholder="Search country..." />
                                        {Object.entries(DCTS_COUNTRIES).flatMap(([tier, countries]) => [
                                            ...countries.sort().map((c) => (
                                                <ComboboxItem key={`${tier}-${c}`} value={c} className="text-xs">{c}</ComboboxItem>
                                            )),
                                        ])}
                                    </ComboboxContent>
                                </Combobox>
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                    HS Code
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 6109"
                                    value={rooForm.commodityCode}
                                    onChange={(e) => setRooForm(f => ({ ...f, commodityCode: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                    Origin Value (£)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={rooForm.valueOrigin}
                                    onChange={(e) => setRooForm(f => ({ ...f, valueOrigin: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                    UK Value (£)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={rooForm.valueUK}
                                    onChange={(e) => setRooForm(f => ({ ...f, valueUK: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                                    Third Party (£)
                                </label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={rooForm.valueThirdParty}
                                    onChange={(e) => setRooForm(f => ({ ...f, valueThirdParty: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSimulate}
                            disabled={!rooForm.originCountry || !rooForm.commodityCode || simulating}
                            className="h-8 px-4 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {simulating ? "Simulating..." : "Run RoO Simulation"}
                        </button>

                        {/* Simulation Result */}
                        {rooResult && (
                            <div className={cn(
                                "p-4 rounded-lg border",
                                rooResult.isCompliant ? "bg-green-50/50 border-green-200" : "bg-red-50/50 border-red-200"
                            )}>
                                <div className="flex items-center gap-2 mb-2">
                                    {rooResult.isCompliant
                                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        : <AlertTriangle className="h-4 w-4 text-red-600" />}
                                    <span className={cn(
                                        "text-xs font-semibold",
                                        rooResult.isCompliant ? "text-green-700" : "text-red-700"
                                    )}>
                                        {rooResult.isCompliant ? "COMPLIANT" : "NON-COMPLIANT"}
                                    </span>
                                </div>

                                {/* Value Added Bar */}
                                <div className="mb-3">
                                    <div className="flex justify-between text-[0.625rem] mb-1">
                                        <span className="text-gray-500">Value Added</span>
                                        <span className="font-medium text-black">{rooResult.valueAddedPercent.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                        <div
                                            className={cn(
                                                "h-1.5 rounded-full transition-all",
                                                rooResult.isCompliant ? "bg-green-500" : "bg-red-500"
                                            )}
                                            style={{ width: `${Math.min(rooResult.valueAddedPercent, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[0.5625rem] mt-0.5">
                                        <span className="text-gray-300">0%</span>
                                        <span className="text-gray-400 font-medium">Threshold: {rooResult.threshold}%</span>
                                        <span className="text-gray-300">100%</span>
                                    </div>
                                </div>

                                <p className="text-[0.6875rem] text-gray-600 leading-relaxed">{rooResult.message}</p>

                                {rooResult.cumulationApplied && (
                                    <div className="flex items-center gap-1.5 mt-2 text-[0.625rem] text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        <Info className="h-3 w-3" />
                                        Regional cumulation rules applied
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Trade Lanes Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">Active Trade Lanes</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[0.625rem] text-gray-400">{lanes?.length ?? 0} lanes</span>
                    </div>
                </div>

                {
                    lanes && lanes.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50">
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Origin</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">HS Code</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Description</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">DCTS Tier</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider text-right">Savings</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {lanes.map((lane) => (
                                    <tr key={lane._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-3.5 w-3.5 text-gray-400" />
                                                <span className="text-xs font-medium text-black">{lane.originCountry}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[0.6875rem] text-gray-600 font-mono">{lane.commodityCode}</td>
                                        <td className="px-6 py-4 text-[0.6875rem] text-gray-600 truncate max-w-[200px]">{lane.description}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "text-[0.625rem] font-medium px-2 py-0.5 rounded-md",
                                                lane.tier === "Comprehensive" ? "bg-green-100 text-green-700" :
                                                    lane.tier === "Enhanced" ? "bg-blue-100 text-blue-700" :
                                                        "bg-gray-100 text-gray-700"
                                            )}>
                                                {lane.tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    lane.status === "Verified" ? "bg-green-500" :
                                                        lane.status === "Review" ? "bg-orange-500 animate-pulse" :
                                                            "bg-red-500"
                                                )} />
                                                <span className="text-[0.6875rem] text-gray-600">{lane.status}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[0.6875rem] font-medium text-gray-500">
                                                {lane.savingsEstimate ? `£${lane.savingsEstimate.toLocaleString()}` : "—"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-16 text-center">
                            <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 border border-gray-200">
                                <ShieldCheck className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-gray-600 font-normal text-sm mb-1">No Active Trade Lanes</h3>
                            <p className="text-gray-400 text-xs mb-4">Create your first trade lane to begin compliance monitoring.</p>
                            <button className="px-4 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors">
                                Create Trade Lane
                            </button>
                        </div>
                    )
                }
            </div>
        </div>
    );
}
