"use client";

import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "../../../../../convex/_generated/api";
import {
    Building2,
    Globe,
    Mail,
    Phone,
    ShieldCheck,
    History,
    ArrowLeft,
    Zap,
    MessageSquare,
    FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function ProspectProfilePage() {
    const params = useParams();
    const router = useRouter();
    const leadId = params.id as Id<"prospects">;

    const lead = useQuery(api.leads.getLead, { id: leadId });

    if (!lead) {
        return <div className="p-8 flex items-center justify-center h-full">Loading Profile...</div>;
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans">
            {/* Navigation Header */}
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="gap-2" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Prospects
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2 rounded-full">
                        <MessageSquare className="h-4 w-4" />
                        Add Note
                    </Button>
                    <Button className="gap-2 rounded-full bg-primary hover:bg-primary/90">
                        <Zap className="h-4 w-4" />
                        Draft AI Proposal
                    </Button>
                </div>
            </div>

            {/* Profile Overview Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 overflow-hidden border-none shadow-lg">
                    <div className="h-32 bg-primary/10 relative">
                        <div className="absolute -bottom-10 left-8">
                            <div className="w-20 h-20 rounded-2xl bg-card border-4 border-background flex items-center justify-center shadow-md">
                                <Building2 className="h-10 w-10 text-primary" />
                            </div>
                        </div>
                    </div>
                    <CardHeader className="pt-14 px-8 pb-8">
                        <div className="flex items-center justify-between mb-2">
                            <CardTitle className="text-3xl font-bold">{lead.companyName}</CardTitle>
                            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                                {lead.status}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-2">
                            <div className="flex items-center gap-1.5">
                                <Globe className="h-4 w-4" />
                                {lead.country}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="h-4 w-4 text-green-600" />
                                {lead.dctsTier} Framework (0% Duty)
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 flex border-t bg-muted/30 p-6 gap-8">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Primary Commodities</p>
                            <div className="flex gap-2">
                                <Badge variant="secondary" className="font-mono">{lead.primaryHS}</Badge>
                                <Badge variant="secondary">Apparel & Textiles</Badge>
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Reliability Score</p>
                            <div className="flex items-center gap-3">
                                <p className="text-2xl font-bold text-primary">{(lead.reliabilityScore * 100).toFixed(0)}%</p>
                                <div className="flex-1 h-2 bg-muted rounded-full">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${lead.reliabilityScore * 100}%` }} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Contact Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-2">
                        <div className="p-4 rounded-xl bg-muted/50 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-primary border border-border">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Email</p>
                                    <p className="text-sm font-medium truncate">{lead.contactEmail || "N/A"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-primary border border-border">
                                    <Phone className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Phone</p>
                                    <p className="text-sm font-medium">{lead.contactPhone || "Request Access"}</p>
                                </div>
                            </div>
                        </div>
                        <Button variant="ghost" className="w-full text-primary hover:text-primary hover:bg-primary/5 text-xs">
                            Update Contact Information
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Shipment History & Intelligence Section */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-8">
                <Card className="lg:col-span-4 border-none shadow-sm h-fit">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl">HMRC Shipment Feed</CardTitle>
                            <CardDescription>Live data matching this profile's trade lane.</CardDescription>
                        </div>
                        <History className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="text-[10px] uppercase font-bold">Date</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Commodity</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Qty (TEU)</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="text-sm">24 Feb 2026</TableCell>
                                    <TableCell className="text-sm font-medium">{lead.primaryHS}</TableCell>
                                    <TableCell className="text-sm">12</TableCell>
                                    <TableCell><Badge variant="outline" className="bg-green-50 text-green-600 border-green-100">Dispatched</Badge></TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="text-sm">10 Feb 2026</TableCell>
                                    <TableCell className="text-sm font-medium">6204.62</TableCell>
                                    <TableCell className="text-sm">45</TableCell>
                                    <TableCell><Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100">Arrived (Felixstowe)</Badge></TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-primary text-primary-foreground">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                DCTS Advantage
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-primary-foreground/90">
                            <p className="text-sm">
                                This exporter qualifies for **0% import duty** under the Enhanced Framework.
                            </p>
                            <div className="p-3 rounded-lg bg-white/10 space-y-2 border border-white/20">
                                <p className="text-xs font-bold uppercase">Estimated Duty Savings</p>
                                <p className="text-xl font-bold">£4,200 / TEU</p>
                            </div>
                            <p className="text-xs italic">
                                *Compared to standard MFN rate (12.5%).
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
