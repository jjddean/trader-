import React from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { HSCodeLookup } from '@/components/tools/HSCodeLookup';
import { Search } from 'lucide-react';

export default function PublicHSCodeSearchPage() {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col pt-[64px]">
            <SiteHeader />
            <main className="flex-grow w-full pb-24 relative">
                {/* Hero Section */}
                <section className="bg-slate-900 text-white pt-20 pb-20 px-6 relative border-b border-slate-800">
                    <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
                        <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-blue-900/20">
                            <Search className="h-7 w-7 text-white" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            HS Code & Commodity Lookup
                        </h1>
                        <p className="text-lg text-slate-400 max-w-2xl">
                            Search the official UK Trade Tariff (HMRC) rapidly. Find accurate harmonized system codes and descriptions for your customs declarations.
                        </p>
                    </div>
                </section>

                {/* Search Tool Form */}
                <section className="max-w-4xl mx-auto px-6 -mt-8 relative z-10">
                    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8 sm:p-10">
                        <HSCodeLookup />
                    </div>
                </section>
            </main>
            <SiteFooter isSignedIn={false} />
        </div>
    );
}
