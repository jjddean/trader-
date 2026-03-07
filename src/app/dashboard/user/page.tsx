"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Globe, Search, TrendingUp, Zap, ShieldCheck } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dctsCountries } from "@/lib/data/stub-dcts";
import { useReferenceData } from "@/hooks/useReferenceData";

interface HSCode {
    hs_code: string;
    description: string;
    chapter: string;
    section: string;
}

export default function UserDashboard() {
    const [selectedCountry, setSelectedCountry] = useState<string>("");
    const [commodityCode, setCommodityCode] = useState<string>("");
    const [valueUK, setValueUK] = useState<number>(0);
    const [valueOrigin, setValueOrigin] = useState<number>(0);
    const [valueThirdParty, setValueThirdParty] = useState<number>(0);
    const [materials, setMaterials] = useState<{ country: string; value: number; description: string }[]>([]);
    const [simResult, setSimResult] = useState<any>(null);
    const [hsSearchOpen, setHsSearchOpen] = useState(false);

    // External Data Hooks (Stage 2/4)
    const { data: hsCodes, isLoading: isLoadingHS } = useReferenceData<HSCode[]>("hs_codes");

    // Convex Hooks (Assume userId "test_user" for MVP/Phase 2)
    const lanes = useQuery(api.trade_lanes.getLanes, { userId: "test_user" });
    const createLane = useMutation(api.trade_lanes.createLane);
    const simulateRoO = useMutation(api.compliance.simulateRoO);
    const eligibility = useQuery(api.compliance.checkEligibility,
        selectedCountry ? { originCountry: selectedCountry } : "skip"
    );

    const filteredHS = hsCodes?.filter(hs =>
        hs.hs_code.startsWith(commodityCode) ||
        hs.description.toLowerCase().includes(commodityCode.toLowerCase())
    ).slice(0, 10);

    const handleAddMaterial = () => {
        setMaterials([...materials, { country: "", value: 0, description: "" }]);
    };

    const handleUpdateMaterial = (index: number, field: string, value: any) => {
        const newMaterials = [...materials];
        newMaterials[index] = { ...newMaterials[index], [field]: value };
        setMaterials(newMaterials);
    };

    const handleRemoveMaterial = (index: number) => {
        setMaterials(materials.filter((_, i) => i !== index));
    };

    const handleRunSimulation = async () => {
        if (!selectedCountry) return;

        const result = await simulateRoO({
            originCountry: selectedCountry,
            commodityCode: commodityCode || "Unknown",
            valueUK,
            valueOrigin,
            valueThirdParty,
            materials: materials.length > 0 ? materials : undefined,
        });

        setSimResult(result);

        await createLane({
            userId: "test_user",
            originCountry: selectedCountry,
            commodityCode: commodityCode || "Unknown",
            description: result.message,
            tier: eligibility?.tier || "Standard",
            status: result.isCompliant ? "Verified" : "Action Required",
            savingsEstimate: result.isCompliant ? 1200 : 0,
        });
    };

    return (
        <div className="space-y-8 p-6 lg:p-10">
            {/* Grid Stats */}

            {/* Grid Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Active Trade Lanes</CardTitle>
                        <Globe className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{lanes?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">Real-time stats from Convex</p>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
                        <ShieldCheck className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">98.5%</div>
                        <p className="text-xs text-muted-foreground">High confidence</p>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Duty Savings</CardTitle>
                        <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">£458,200</div>
                        <p className="text-xs text-muted-foreground">+£12,300/mo avg</p>
                    </CardContent>
                </Card>
                <Card className="bg-card">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Simulations Run</CardTitle>
                        <Zap className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">142</div>
                        <p className="text-xs text-muted-foreground">Across 15 countries</p>
                    </CardContent>
                </Card>
            </div>

            {/* RoO Simulator / Trade Lane Section */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
                <Card className="lg:col-span-4 bg-card">
                    <CardHeader>
                        <CardTitle>Trade Lane Intelligence</CardTitle>
                        <CardDescription>Configure a lane to check eligibility and simulate tariff savings.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Origin Country</label>
                                <Select onValueChange={setSelectedCountry} value={selectedCountry}>
                                    <SelectTrigger className="bg-background">
                                        <SelectValue placeholder="Select DCTS Country" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dctsCountries.map((country) => (
                                            <SelectItem key={country.name} value={country.name}>
                                                {country.name} ({country.tier})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 relative">
                                <label className="text-sm font-medium">HS Code / Commodity Code</label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={isLoadingHS ? "Loading codes..." : "Search code or product..."}
                                        className="pl-8 bg-background"
                                        value={commodityCode}
                                        onChange={(e) => {
                                            setCommodityCode(e.target.value);
                                            setHsSearchOpen(true);
                                        }}
                                        onFocus={() => setHsSearchOpen(true)}
                                        disabled={isLoadingHS}
                                    />
                                </div>
                                {hsSearchOpen && commodityCode.length >= 2 && filteredHS && filteredHS.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                                        {filteredHS.map((hs) => (
                                            <div
                                                key={hs.hs_code}
                                                className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                                                onClick={() => {
                                                    setCommodityCode(hs.hs_code);
                                                    setHsSearchOpen(false);
                                                }}
                                            >
                                                <span className="font-bold text-primary mr-2">{hs.hs_code}</span>
                                                <span className="text-muted-foreground line-clamp-1">{hs.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase">UK Value Added (£)</label>
                                <Input
                                    type="number"
                                    value={valueUK}
                                    onChange={(e) => setValueUK(Number(e.target.value))}
                                    className="bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase">Origin Value (£)</label>
                                <Input
                                    type="number"
                                    value={valueOrigin}
                                    onChange={(e) => setValueOrigin(Number(e.target.value))}
                                    className="bg-background"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-muted-foreground uppercase">Third Party (£)</label>
                                <Input
                                    type="number"
                                    value={valueThirdParty}
                                    onChange={(e) => setValueThirdParty(Number(e.target.value))}
                                    className="bg-background"
                                />
                            </div>
                        </div>

                        {/* Advanced: Materials Cumulation */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold">Bill of Materials (Regional Cumulation)</h3>
                                <Button variant="outline" size="sm" onClick={handleAddMaterial}>
                                    Add Material
                                </Button>
                            </div>
                            {materials.map((m, i) => (
                                <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                                    <div className="md:col-span-4 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Country</label>
                                        <Select onValueChange={(val) => handleUpdateMaterial(i, "country", val)} value={m.country}>
                                            <SelectTrigger><SelectValue placeholder="Origin" /></SelectTrigger>
                                            <SelectContent>
                                                {dctsCountries.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                                                <SelectItem value="UK">United Kingdom</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Value (£)</label>
                                        <Input type="number" value={m.value} onChange={(e) => handleUpdateMaterial(i, "value", Number(e.target.value))} />
                                    </div>
                                    <div className="md:col-span-4 space-y-1">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Description</label>
                                        <Input placeholder="e.g., Fabric" value={m.description} onChange={(e) => handleUpdateMaterial(i, "description", e.target.value)} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <Button variant="ghost" size="sm" className="text-destructive h-10 w-full" onClick={() => handleRemoveMaterial(i)}>Remove</Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {simResult && (
                            <div className={`p-4 rounded-lg border ${simResult.isCompliant ? 'border-green-500/20 bg-green-500/5' : 'border-destructive/20 bg-destructive/5'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <ShieldCheck className={`h-5 w-5 ${simResult.isCompliant ? 'text-green-500' : 'text-destructive'}`} />
                                    <p className={`font-bold ${simResult.isCompliant ? 'text-green-600' : 'text-destructive'}`}>
                                        {simResult.isCompliant ? 'Compliance Verified' : 'Compliance Denied'}
                                    </p>
                                </div>
                                <p className="text-sm">{simResult.message}</p>
                                <div className="mt-2 text-xs flex gap-4 text-muted-foreground">
                                    <span>Added Value: {simResult.valueAddedPercent.toFixed(1)}%</span>
                                    <span>Threshold: {simResult.threshold}%</span>
                                    {simResult.cumulationApplied && <span className="text-primary font-medium italic">Group Cumulation Benefit Applied ✅</span>}
                                </div>
                            </div>
                        )}

                        <div className="bg-muted p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-primary">Ready to Verify</p>
                                <p className="text-sm text-muted-foreground">
                                    Finalize your material breakdown to run the RoO simulator.
                                </p>
                            </div>
                            <Button disabled={!selectedCountry} onClick={handleRunSimulation} className="font-bold">
                                Run Compliance Test
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-2 bg-card">
                    <CardHeader>
                        <CardTitle>Recent Wins</CardTitle>
                        <CardDescription>Latest active trade lanes from Convex.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {lanes?.slice(0, 3).map((lane) => (
                            <div key={lane._id} className="flex items-center gap-4 text-sm">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                    <Calculator className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">{lane.originCountry}</p>
                                    <p className="text-xs text-muted-foreground">Code: {lane.commodityCode}</p>
                                </div>
                                <p className="text-xs font-semibold text-green-500">Verified</p>
                            </div>
                        ))}
                        {(!lanes || lanes.length === 0) && (
                            <p className="text-sm text-muted-foreground text-center py-4">No active lanes yet.</p>
                        )}
                        <Button variant="link" className="w-full text-xs" asChild>
                            <Link href="#">View All Metrics</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
