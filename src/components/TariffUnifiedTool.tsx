'use client';

import React, { useState } from 'react';
import { TariffCalculator } from './TariffCalculator';
import { FullModeSimulator } from './FullModeSimulator';
import { cn } from '@/lib/utils';

export const TariffUnifiedTool = () => {
  const [mode, setMode] = useState<'simplified' | 'advanced'>('simplified');

  return (
    <div className="w-full space-y-6">
      <div className="flex gap-6 border-b border-slate-100">
        <button
          type="button"
          onClick={() => setMode('simplified')}
          className={cn(
            'pb-3 text-sm font-semibold transition-colors',
            mode === 'simplified'
              ? 'border-b-2 border-slate-900 text-slate-900'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Import cost calculator
        </button>
        <button
          type="button"
          onClick={() => setMode('advanced')}
          className={cn(
            'pb-3 text-sm font-semibold transition-colors',
            mode === 'advanced'
              ? 'border-b-2 border-slate-900 text-slate-900'
              : 'text-slate-500 hover:text-slate-700',
          )}
        >
          Duty &amp; VAT simulator
        </button>
      </div>

      {mode === 'simplified' ? <TariffCalculator /> : <FullModeSimulator />}
    </div>
  );
};
