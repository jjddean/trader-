"use client";

import React, { useState } from 'react';
import { countries } from '@/lib/data/countries';
import { Search, ShieldCheck, ShieldAlert, Globe, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function DctsCheckerPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-gray-900">DCTS Eligibility Checker</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Check global country eligibility for Developing Countries Trading Scheme (DCTS) preferences.
                    </p>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by country name or ISO code (e.g. US, India)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none transition-all focus:border-black focus:ring-1 focus:ring-black"
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCountries.map((country) => (
                    <div 
                        key={country.code} 
                        className="group relative flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold tracking-tight text-gray-900">
                                    {country.code}
                                </span>
                                <span className="text-sm font-medium text-gray-600 truncate max-w-[150px]">
                                    {country.name}
                                </span>
                            </div>
                            {country.tier ? (
                                <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-100 text-[10px] uppercase tracking-wider">
                                    Eligible
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-gray-400 border-gray-100 text-[10px] uppercase tracking-wider font-normal">
                                    Standard
                                </Badge>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5 pt-1">
                            {country.tier ? (
                                <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    <span>DCTS {country.tier} Tier</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span>Most Favoured Nation (MFN)</span>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-2 flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">
                            <Info className="h-3 w-3 mt-0.5 text-gray-400 shrink-0" />
                            <p>
                                {country.tier 
                                    ? `This country qualifies for ${country.tier === "Comprehensive" ? "Duty-Free Quota-Free" : "Reduced"} rates on many goods.`
                                    : "Standard import tariffs apply unless a specific Free Trade Agreement (FTA) is in place."
                                }
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {filteredCountries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <ShieldAlert className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-500">No matching countries found.</p>
                </div>
            )}
        </div>
    );
}
