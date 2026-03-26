import React from 'react';

export default function LandedCostCalculatorPage() {
    return (
        <div className="space-y-8 p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight text-gray-900">Landed Cost Calculator</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Estimate UK import duties, VAT, and freight costs.
                    </p>
                </div>
            </div>
            
            <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-500">Tool implementation in progress.</p>
            </div>
        </div>
    );
}
