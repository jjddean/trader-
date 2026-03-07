"use client";

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Search, Filter, Globe, Building2, Tag, Loader2, Save, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function CompanySearchPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const searchCompanies = useAction(api.actions.companies.searchCompanies);
    const saveCompany = useMutation(api.saved_companies.saveCompany);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setIsSearching(true);
        try {
            const data = await searchCompanies({ query });
            setResults(data);
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSave = async (company: any) => {
        setSavingId(company.id);
        try {
            await saveCompany({
                companyId: company.id,
                companyName: company.name,
                country: company.country || company.location || "Unknown",
                category: company.category,
            });
            setSavedIds(prev => {
                const newSet = new Set(prev);
                newSet.add(company.id);
                return newSet;
            });
        } catch (error) {
            console.error("Save failed:", error);
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="space-y-8 p-6 lg:p-10">

            <Card className="bg-card">
                <CardHeader className="py-4">
                    <div>
                        <CardTitle className="text-lg font-semibold">Global Discovery</CardTitle>
                        <CardDescription className="text-xs">Search by name, category, country, or HS code.</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="e.g., 'Textiles in India' or '851713'"
                                className="pl-10 h-11"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                        <Button type="submit" size="lg" disabled={isSearching}>
                            {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Search World"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Filters Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Filter className="h-4 w-4" /> Filters
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase text-muted-foreground">Countries</p>
                                <div className="space-y-1">
                                    {results?.facet_counts?.find((f: any) => f.field_name === "country")?.counts.map((c: any) => (
                                        <div key={c.value} className="flex items-center justify-between text-sm">
                                            <span>{c.value}</span>
                                            <Badge variant="secondary">{c.count}</Badge>
                                        </div>
                                    ))}
                                    {!results && <p className="text-sm text-muted-foreground italic">Search to see facets</p>}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs font-bold uppercase text-muted-foreground">Categories</p>
                                <div className="space-y-1">
                                    {results?.facet_counts?.find((f: any) => f.field_name === "category")?.counts.map((c: any) => (
                                        <div key={c.value} className="flex items-center justify-between text-sm">
                                            <span>{c.value}</span>
                                            <Badge variant="secondary">{c.count}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Results Table */}
                <div className="lg:col-span-3">
                    <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Company Name</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead>Industry</TableHead>
                                    <TableHead>HS Relation</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results?.hits?.map((hit: any) => (
                                    <TableRow key={hit.document.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-primary" />
                                                    <span dangerouslySetInnerHTML={{
                                                        __html: hit.highlight?.name?.snippet || hit.document.name
                                                    }} />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground opacity-50 ml-6">{hit.document.id}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Globe className="h-3 w-3 text-muted-foreground" />
                                                <span dangerouslySetInnerHTML={{
                                                    __html: hit.highlight?.country?.snippet || hit.document.country
                                                }} />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                <span dangerouslySetInnerHTML={{
                                                    __html: hit.highlight?.category?.snippet || hit.document.category
                                                }} />
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-mono text-xs">
                                            {hit.document.hscode}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleSave(hit.document)}
                                                disabled={savingId === hit.document.id || savedIds.has(hit.document.id)}
                                            >
                                                {savingId === hit.document.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : savedIds.has(hit.document.id) ? (
                                                    <Check className="h-4 w-4 text-green-500" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {results?.hits?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                            No companies found matching "{query}".
                                        </TableCell>
                                    </TableRow>
                                )}
                                {!results && !isSearching && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                                            Enter a query above to explore global trade partners.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {isSearching && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </div>
    );
}
