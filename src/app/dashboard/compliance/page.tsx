"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ShieldCheck, Info, Globe, AlertTriangle, CheckCircle2, Search, ArrowRight, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dctsCountries } from "@/lib/data/stub-dcts";

export default function DctsEligibilityPage() {
    const [searchCountry, setSearchCountry] = useState("");
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

    const eligibility = useQuery(api.compliance.checkEligibility,
        selectedCountry ? { originCountry: selectedCountry } : "skip"
    );

    const filteredCountries = dctsCountries.filter(c =>
        c.name.toLowerCase().includes(searchCountry.toLowerCase())
    ).slice(0, 5);

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col gap-1">
                <h1 className="text-xl font-semibold tracking-tight">Eligibility Engine</h1>
                <p className="text-sm text-muted-foreground">
                    Verify country eligibility and duty-free access under the Developing Countries Trading Scheme.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Search & Selector */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Search className="h-4 w-4" /> Find Country
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                placeholder="Search country..."
                                value={searchCountry}
                                onChange={(e) => setSearchCountry(e.target.value)}
                            />
                            <div className="space-y-1">
                                {filteredCountries.map((c) => (
                                    <Button
                                        key={c.name}
                                        variant={selectedCountry === c.name ? "default" : "ghost"}
                                        className="w-full justify-start text-sm"
                                        onClick={() => setSelectedCountry(c.name)}
                                    >
                                        <Globe className="mr-2 h-4 w-4" />
                                        {c.name}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary/5 border-primary/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <BookOpen className="h-4 w-4" /> Program Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-3">
                            <p><strong>Comprehensive</strong>: 0% duty on 99% of goods lines.</p>
                            <p><strong>Enhanced</strong>: 0% duty on 2/3 of goods lines.</p>
                            <p><strong>Standard</strong>: Reduced duties on over 80% of lines.</p>
                            <Button variant="link" className="p-0 h-auto text-[10px]" asChild>
                                <a href="https://www.gov.uk/government/publications/developing-countries-trading-scheme-dcts-guidance" target="_blank">View Official HMRC Guidance</a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Eligibility Result */}
                <div className="lg:col-span-2 space-y-6">
                    {!selectedCountry ? (
                        <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground bg-muted/20">
                            <Globe className="h-12 w-12 mb-4 opacity-50" />
                            <p>Select a country to verify DCTS status.</p>
                        </div>
                    ) : (
                        <Card className="border-2 border-primary/10 overflow-hidden">
                            <div className={`h-2 w-full ${eligibility?.eligible ? 'bg-green-500' : 'bg-muted'}`} />
                            <CardHeader className="flex flex-row items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-semibold tracking-tight">{selectedCountry}</h2>
                                        {eligibility?.eligible ? (
                                            <Badge className="bg-green-500 hover:bg-green-600 text-[10px] h-5">Eligible</Badge>
                                        ) : (
                                            <Badge variant="secondary" className="text-[10px] h-5">Check Needed</Badge>
                                        )}
                                    </div>
                                    <CardDescription className="text-xs">Compliance Audit Profile</CardDescription>
                                </div>
                                <ShieldCheck className={`h-10 w-10 ${eligibility?.eligible ? 'text-primary' : 'text-muted-foreground'}`} />
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Framework Tier</p>
                                        <p className="text-lg font-black text-primary">{eligibility?.tier || "Detecting..."}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Duty Benefit</p>
                                        <p className="text-lg font-black text-primary">{eligibility?.duty || "Standard"}</p>
                                    </div>
                                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground">Data Confidence</p>
                                        <p className="text-lg font-black text-primary">{(eligibility?.confidence ? eligibility.confidence * 100 : 0)}%</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold flex items-center gap-2 underline decoration-primary decoration-2 underline-offset-4">
                                        Verification Checklist
                                    </h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 p-3 rounded-md bg-green-500/10 border border-green-500/20 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            <span>Country is a confirmed participant in the {eligibility?.tier} Tier.</span>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-sm">
                                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                            <span>Rules of Origin (RoO) check required for specific HS Code classification.</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <Button className="flex-1 font-bold" variant="outline" onClick={() => window.location.href = '/dashboard/calculator'}>
                                        Calculate Tariffs
                                    </Button>
                                    <Button className="flex-1 font-bold" onClick={() => window.location.href = '/dashboard/user'}>
                                        Run RoO Simulator
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
