'use client';

import { TariffUnifiedTool } from '@/components/TariffUnifiedTool';

export default function ToolsPage() {
    return (
        <div className="min-h-screen flex flex-col">
            <main className="flex-1 bg-slate-50">
                <section className="pt-24 pb-12 px-6 relative">
                    <div className="max-w-5xl mx-auto">
                        {/* Tariff Tool */}
                        <div className="relative">
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-8 md:p-12 bg-slate-50/50 border-b border-slate-100">
                                    <div className="text-center mb-8">
                                        <div className="inline-flex items-center px-3 py-1 bg-blue-50 rounded-full mb-4">
                                            <span className="text-blue-600 text-xs font-bold uppercase tracking-wider">Tariff Tool</span>
                                        </div>
                                        <h2 className="text-3xl font-bold text-slate-900 mb-3">
                                            UK Import <span className="text-blue-600">Calculator</span>
                                        </h2>
                                        <p className="text-slate-500 text-base max-w-2xl mx-auto">
                                            Estimate UK Import Duty, VAT, and total landed costs using simplified and advanced audit modes.
                                        </p>
                                    </div>
                                    <div className="max-w-2xl mx-auto">
                                        <TariffUnifiedTool />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Compliance Note */}
                <section className="py-24 bg-white text-slate-900 border-t border-slate-200 relative overflow-hidden">
                    <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
                        <h2 className="text-2xl font-bold mb-6 text-slate-900">Declaration support</h2>
                        <p className="text-slate-500 mb-16 max-w-2xl mx-auto text-base">
                            Our internal compliance team reviews all Import Declarations for accuracy.
                            We track the entire import lifecycle in your Freightcode dashboard.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group">
                                <div className="text-blue-600 font-bold text-lg mb-4 italic tracking-tighter group-hover:translate-x-1 transition-transform inline-block">01. ESTIMATE</div>
                                <p className="text-sm text-slate-500 leading-relaxed">Use the calculator to evaluate landed costs and identify applicable duty rates.</p>
                            </div>
                            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group">
                                <div className="text-blue-600 font-bold text-lg mb-4 italic tracking-tighter group-hover:translate-x-1 transition-transform inline-block">02. UPLOAD</div>
                                <p className="text-sm text-slate-500 leading-relaxed">Securely upload your Commercial Invoices and Packing Lists. Extracted fields help pre-fill goods items on declarations.</p>
                            </div>
                            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-colors group">
                                <div className="text-blue-600 font-bold text-lg mb-4 italic tracking-tighter group-hover:translate-x-1 transition-transform inline-block">03. MANAGE</div>
                                <p className="text-sm text-slate-500 leading-relaxed">We process the declarations and update your status to <span className="text-emerald-600 font-medium">"Clearance in Progress"</span>. Track every shipment in real-time.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
