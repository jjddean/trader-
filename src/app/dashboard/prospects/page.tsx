"use client";

import { useState } from "react";
import { Search, Globe, Zap, Mail, Phone, ExternalLink, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { dctsCountries } from "@/lib/data/stub-dcts";

export default function ProspectAcquisitionPage() {
    const [searchHS, setSearchHS] = useState("");
    const [selectedCountry, setSelectedCountry] = useState("All");

    const leads = useQuery(api.leads.listLeads, {
        hsCode: searchHS || undefined,
        country: selectedCountry === "All" ? undefined : selectedCountry,
    });

    const syncLeads = useMutation(api.leads.syncHMRCLeads);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await syncLeads();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Prospect Acquisition</h1>
                    <p className="text-muted-foreground">Find exporters in DCTS countries based on live HMRC shipment data.</p>
                </div>
                <Button onClick={handleSync} disabled={isSyncing} className="rounded-full">
                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Sync Live HMRC Data
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                    <CardDescription>Narrow down leads by HS code or Origin country.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Filter by HS Code (e.g. 6109)"
                                className="pl-8"
                                value={searchHS}
                                onChange={(e) => setSearchHS(e.target.value)}
                            />
                        </div>
                        <select
                            className="flex h-10 w-full md:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                        >
                            <option value="All">All Countries</option>
                            {dctsCountries.map(c => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Prospective Exporters</CardTitle>
                    <CardDescription>Live matches based on UK trade policy advantages.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Company</TableHead>
                                <TableHead>Country / Tier</TableHead>
                                <TableHead>Primary HS Code</TableHead>
                                <TableHead>Reliability</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leads?.map((lead) => (
                                <TableRow
                                    key={lead._id}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => window.location.href = `/dashboard/prospects/${lead._id}`}
                                >
                                    <TableCell className="font-bold text-primary">{lead.companyName}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{lead.country}</span>
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">{lead.dctsTier} Framework</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded border border-border">{lead.primaryHS}</code>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary"
                                                    style={{ width: `${lead.reliabilityScore * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold">{(lead.reliabilityScore * 100).toFixed(0)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={lead.status === "New" ? "default" : "secondary"} className="rounded-full px-3">
                                            {lead.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                                <Mail className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                                                <Zap className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="rounded-full text-xs"
                                                onClick={() => window.location.href = `/dashboard/prospects/${lead._id}`}
                                            >
                                                View Profile
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {leads?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        No prospects found. Try syncing live HMRC data.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
