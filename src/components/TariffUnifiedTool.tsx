'use client';

import React, { useState } from 'react';
import { TariffCalculator } from './TariffCalculator';
import { FullModeSimulator } from './FullModeSimulator';
import { cn } from '@/lib/utils';

export const TariffUnifiedTool = () => {
    const [mode, setMode] = useState<'simplified' | 'advanced'>('simplified');

    return (
        <div className="w-full max-w-md mx-auto space-y-6">
            {/* Toggle Switch */}
            <div className="flex items-center justify-center gap-2 p-1 bg-slate-100 border border-slate-200 rounded-full w-fit mx-auto">
                <button
                    onClick={() => setMode('simplified')}
                    className={cn(
                        "px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                        mode === 'simplified'
                            ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    UK Import Cost Calculator
                </button>
                <button
                    onClick={() => setMode('advanced')}
                    className={cn(
                        "px-6 py-2.5 rounded-full text-sm font-medium transition-all",
                        mode === 'advanced'
                            ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                            : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    UK Duty & VAT Simulator
                </button>
            </div>

            {/* Content with Animation */}
            <div className="relative min-h-[500px]">
                {mode === 'simplified' ? (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <TariffCalculator />
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <FullModeSimulator />
                    </div>
                )}
            </div>
        </div>
    );
};
