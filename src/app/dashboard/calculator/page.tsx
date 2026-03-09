/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
    Calculator,
    ArrowRight,
    Clock,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const DCTS_COUNTRIES = [
    "Afghanistan", "Algeria", "Angola", "Armenia", "Bangladesh", "Benin", "Bhutan",
    "Bolivia", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Cape Verde",
    "Central African Republic", "Chad", "Comoros", "Congo", "Cook Islands",
    "Democratic Republic of Congo", "Djibouti", "Eritrea", "Ethiopia",
    "Gambia", "Guinea", "Guinea-Bissau", "Haiti", "India", "Indonesia",
    "Kenya", "Kiribati", "Kyrgyzstan", "Laos", "Lesotho", "Liberia",
    "Madagascar", "Malawi", "Mali", "Mauritania", "Micronesia", "Mongolia",
    "Mozambique", "Myanmar", "Nepal", "Niger", "Nigeria", "Niue",
    "Pakistan", "Philippines", "Rwanda", "Samoa", "Senegal", "Sierra Leone",
    "Solomon Islands", "Somalia", "South Sudan", "Sri Lanka", "Sudan", "Syria",
    "Tajikistan", "Tanzania", "Timor-Leste", "Togo", "Tuvalu", "Uganda",
    "Uzbekistan", "Vanuatu", "Vietnam", "Yemen", "Zambia",
].sort();

export default function CalculatorPage() {
    const [form, setForm] = useState({
        hsCode: "",
        originCountry: "",
        itemValue: "",
        shippingCost: "",
        dutyRate: "",
        vatRate: "20",
    });
    const [result, setResult] = useState<any | null>(null);
    const [calculating, setCalculating] = useState(false);

    const calculateLandedCost = useMutation(api.calculator.calculateLandedCost);
    const history = useQuery(api.calculator.getHistory);

    const handleCalculate = async () => {
        if (!form.hsCode || !form.originCountry || !form.itemValue) return;
        setCalculating(true);
        try {
            const res = await calculateLandedCost({
                hsCode: form.hsCode,
                originCountry: form.originCountry,
                itemValue: parseFloat(form.itemValue) || 0,
                shippingCost: parseFloat(form.shippingCost) || 0,
                dutyRate: parseFloat(form.dutyRate) || 0,
                vatRate: parseFloat(form.vatRate) || 20,
            });
            setResult(res);
        } finally {
            setCalculating(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Calculator Form */}
                <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <Calculator className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">Calculate Landed Cost</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">HS Code</label>
                                <input
                                    type="text"
                                    placeholder="e.g. 6109"
                                    value={form.hsCode}
                                    onChange={(e) => setForm(f => ({ ...f, hsCode: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Origin Country</label>
                                <Select value={form.originCountry || undefined} onValueChange={(val) => setForm(f => ({ ...f, originCountry: val }))}>
                                    <SelectTrigger className="w-full h-9 bg-gray-50 border-gray-200 text-xs text-gray-700">
                                        <SelectValue placeholder="Select..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                        {DCTS_COUNTRIES.map(c => (
                                            <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Item Value (£)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={form.itemValue}
                                    onChange={(e) => setForm(f => ({ ...f, itemValue: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Shipping Cost (£)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={form.shippingCost}
                                    onChange={(e) => setForm(f => ({ ...f, shippingCost: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Duty Rate (%)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={form.dutyRate}
                                    onChange={(e) => setForm(f => ({ ...f, dutyRate: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">VAT Rate (%)</label>
                                <input
                                    type="number"
                                    placeholder="20"
                                    value={form.vatRate}
                                    onChange={(e) => setForm(f => ({ ...f, vatRate: e.target.value }))}
                                    className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleCalculate}
                            disabled={!form.hsCode || !form.originCountry || !form.itemValue || calculating}
                            className="h-8 px-4 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors disabled:opacity-40"
                        >
                            {calculating ? "Calculating..." : "Calculate Landed Cost"}
                        </button>

                        {/* Result */}
                        {result && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3 mt-2">
                                <p className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest">Cost Breakdown</p>
                                <div className="space-y-2">
                                    {[
                                        { label: "CIF Value", value: result.cifValue },
                                        { label: "Duty Amount", value: result.dutyAmount },
                                        { label: "VAT Amount", value: result.vatAmount },
                                    ].map((item) => (
                                        <div key={item.label} className="flex justify-between text-[0.6875rem]">
                                            <span className="text-gray-500">{item.label}</span>
                                            <span className="text-gray-700">£{item.value?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    ))}
                                    <div className="border-t border-gray-200 pt-2 flex justify-between text-xs">
                                        <span className="font-medium text-black">Total Landed Cost</span>
                                        <span className="font-semibold text-black">£{result.totalLandedCost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Calculation History */}
                <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-medium text-black">History</h3>
                    </div>
                    {history && history.length > 0 ? (
                        <div className="divide-y divide-gray-50">
                            {history.map((calc: any) => (
                                <div key={calc._id} className="px-6 py-3 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-black font-mono">{calc.hsCode}</span>
                                        <span className="text-[0.625rem] text-gray-400">{calc.originCountry}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.625rem] text-gray-400">£{calc.value?.toLocaleString()}</span>
                                        <div className="flex items-center gap-1">
                                            <ArrowRight className="h-2.5 w-2.5 text-gray-300" />
                                            <span className="text-[0.6875rem] font-medium text-black">£{calc.totalLandedCost?.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Calculator className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">No calculations yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
