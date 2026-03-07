"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Calculator, Euro, PoundSterling, Ship, Info, History, ArrowRight, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useReferenceData } from "@/hooks/useReferenceData";

interface TariffData {
    hs_code: string;
    rate: number;
    vat: number;
    measure: string;
}

export default function TariffCalculatorPage() {
    const [hsCode, setHsCode] = useState("");
    const [itemValue, setItemValue] = useState<number>(0);
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [calculatedResults, setCalculatedResults] = useState<any>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Fetch Tariff reference data for auto-lookup
    const { data: globalTariffs } = useReferenceData<TariffData[]>("tariffs");
    const calculate = useMutation(api.calculator.calculateLandedCost);
    const history = useQuery(api.calculator.getHistory);

    const handleCalculate = async (e: React.FormEvent) => {
        e.preventDefault();

        // Find matching tariff or use defaults
        const matched = globalTariffs?.find(t => t.hs_code === hsCode);
        const dutyRate = matched ? matched.rate : 0;
        const vatRate = matched ? matched.vat : 20;

        setIsCalculating(true);
        try {
            const results = await calculate({
                hsCode,
                originCountry: "TBD", // Expand with country selector later
                itemValue,
                shippingCost,
                dutyRate,
                vatRate
            });
            setCalculatedResults({ ...results, dutyRate, vatRate });
        } catch (err) {
            console.error("Calculation failed:", err);
        } finally {
            setIsCalculating(false);
        }
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">Tariff Calculator</h1>
                <p className="text-sm text-muted-foreground">
                    Landed cost calculations for UK imports under DCTS framework.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Calculator Form */}
                <Card className="lg:col-span-2 bg-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5 text-primary" /> Goods Details
                        </CardTitle>
                        <CardDescription>Enter the value and classification of your shipment.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleCalculate} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">HS Code</label>
                                    <Input
                                        placeholder="e.g., 610910"
                                        value={hsCode}
                                        onChange={(e) => setHsCode(e.target.value)}
                                        className="h-11"
                                    />
                                    <p className="text-[10px] text-muted-foreground italic">
                                        Tip: We'll auto-apply UK Trade Tariff rates if matched.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Exporting Country</label>
                                    <Input placeholder="e.g., Vietnam" className="h-11" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg bg-muted/30">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Goods Value (£)</label>
                                    <div className="relative">
                                        <PoundSterling className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            value={itemValue}
                                            onChange={(e) => setItemValue(Number(e.target.value))}
                                            className="pl-10 h-11"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-muted-foreground">Shipping & Insurance (£)</label>
                                    <div className="relative">
                                        <Ship className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="number"
                                            value={shippingCost}
                                            onChange={(e) => setShippingCost(Number(e.target.value))}
                                            className="pl-10 h-11"
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" size="lg" className="w-full font-bold" disabled={isCalculating}>
                                {isCalculating ? "Calculating..." : "Compute Landed Cost"}
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </form>

                        {calculatedResults && (
                            <div className="mt-8 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h3 className="text-lg font-bold">Calculation Result</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                        <p className="text-xs font-bold text-primary uppercase">Estimated Duty ({calculatedResults.dutyRate}%)</p>
                                        <p className="text-2xl font-black">£{calculatedResults.dutyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                                        <p className="text-xs font-bold text-primary uppercase">Calculated VAT ({calculatedResults.vatRate}%)</p>
                                        <p className="text-2xl font-black">£{calculatedResults.vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                    </div>
                                </div>
                                <div className="p-6 rounded-xl bg-primary text-primary-foreground">
                                    <p className="text-sm font-medium opacity-80 uppercase tracking-wider text-center">Total Landed Cost</p>
                                    <p className="text-5xl font-black text-center mt-2 tracking-tight">
                                        £{calculatedResults.totalLandedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="mt-4 flex justify-between text-xs opacity-70 border-t border-white/20 pt-4">
                                        <span>Goods + Shipping: £{(itemValue + shippingCost).toLocaleString()}</span>
                                        <span>All Taxes Includes</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* History & Insights */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <History className="h-4 w-4" /> Recent Checks
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {history?.map((entry: any) => (
                                <div key={entry._id} className="text-sm border-b pb-2 flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{entry.hsCode}</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(entry.timestamp).toLocaleDateString()}</p>
                                    </div>
                                    <p className="font-bold">£{entry.totalLandedCost.toLocaleString()}</p>
                                </div>
                            ))}
                            {history?.length === 0 && (
                                <p className="text-xs text-muted-foreground italic text-center py-4">No calculation history yet.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-primary">
                                <ShieldCheck className="h-5 w-5" />
                                <h4 className="font-bold text-sm">AI Verification</h4>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Calculations are deterministic and based on official DCTS schedules. Our AI Assistant can explain the "Rules of Origin" logic for this HS Code.
                            </p>
                            <Button variant="outline" size="sm" className="w-full text-xs">
                                Ask AI Explainer
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
