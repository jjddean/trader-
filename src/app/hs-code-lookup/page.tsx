import React from 'react';
import { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { HSCodeLookup } from '@/components/tools/HSCodeLookup';
import { Search } from 'lucide-react';

export const metadata: Metadata = {
    title: "UK HS Code Lookup | HMRC Commodity Code Search | FreightCode",
    description: "Free UK HS Code lookup tool. Search the official HMRC Trade Tariff for accurate commodity codes, duty rates, and product descriptions for your customs declarations.",
    keywords: ["HS Code Lookup", "UK Commodity Codes", "HMRC Tariff Search", "Customs classification", "UK Import Duty", "Trade Tariff"],
    openGraph: {
        title: "UK HS Code Lookup | HMRC Commodity Code Search",
        description: "Find accurate UK commodity codes and duty rates instantly with our free HMRC search tool.",
        type: "website",
    }
};

export default function DedicatedHSCodePage() {
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 flex flex-col">
            <SiteHeader />
            <main className="pt-[140px] pb-24 flex-grow w-full">
                {/* Hero Section */}
                <section className="max-w-3xl mx-auto px-6 mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6 leading-snug">
                        HS Code Lookup
                    </h1>
                    <p className="text-[16px] text-slate-600 leading-relaxed max-w-2xl">
                        Search the official UK Trade Tariff (HMRC) in real-time to find accurate commodity codes, descriptions, and duty rates.
                    </p>
                </section>

                {/* Search Tool Section */}
                <section className="max-w-4xl mx-auto px-6 relative z-20">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-12 transition-all">
                        <div className="mb-8">
                            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                                <Search className="h-5 w-5 text-blue-600" />
                                Start your search
                            </h2>
                            <p className="text-sm text-slate-500">
                                Enter a product name (e.g., "coffee", "bicycles") or the first 4-8 digits of a code.
                            </p>
                        </div>
                        <HSCodeLookup />
                    </div>
                </section>

            </main>
            <footer className="py-12 px-6 bg-slate-50 border-t border-slate-200 w-full mt-auto">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="flex justify-center mb-5">
                        <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
                            <span className="font-bold tracking-tight text-[22px]">freight</span>
                            <span className="font-bold tracking-tight text-[22px] text-slate-600">code</span>
                            <span className="font-normal text-[13px] -translate-y-[5px] ml-[-1px] text-slate-600">®</span>
                        </div>
                    </div>
                    
                    <p className="text-slate-600 text-[15px] mb-8 max-w-lg mx-auto leading-relaxed">
                        Automate your UK customs declarations, uncover hidden duty savings, and ensure total HMRC compliance.
                    </p>
                    
                    <div className="inline-flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 p-6 shadow-sm min-w-[280px]">
                        <span className="text-[16px] font-bold text-slate-900 mb-2">Need direct support? Contact Us</span>
                        <a href="mailto:info@freightcode.co.uk" className="text-blue-600 hover:text-blue-700 hover:underline text-[16px] font-semibold transition-colors">
                            info@freightcode.co.uk
                        </a>
                        <span className="text-[13px] text-slate-500 mt-2 font-medium">London, UK</span>
                    </div>
                    
                    <p className="text-slate-400 text-[13px] mt-12 font-medium">
                        © {new Date().getFullYear()} Freightcode. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
