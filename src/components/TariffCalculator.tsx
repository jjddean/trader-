'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { fetchTradeData, calculateUKImportCosts, TariffCategory } from '@/lib/trade-data';
import { cn } from '@/lib/utils';

const fieldClass =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400';

const labelClass = 'mb-1.5 block text-xs font-medium text-slate-600';

export const TariffCalculator = () => {
  const [step, setStep] = useState<'input' | 'results'>('input');
  const [categories, setCategories] = useState<TariffCategory[]>([]);
  const [inputs, setInputs] = useState({
    categoryId: 'general',
    origin: 'CN',
    goodsValue: '',
    incoterm: 'fob',
    freight: '',
    insurance: '',
    isVatRegistered: true,
    hasPreference: false,
  });
  const [results, setResults] = useState<ReturnType<typeof calculateUKImportCosts> | null>(null);

  useEffect(() => {
    fetchTradeData().then((data) => setCategories(data.categories));
  }, []);

  const handleCalculate = () => {
    const val = parseFloat(inputs.goodsValue) || 0;
    const fr =
      parseFloat(inputs.incoterm === 'cif' || inputs.incoterm === 'ddp' ? '0' : inputs.freight) || 0;
    const ins =
      parseFloat(inputs.incoterm === 'cif' || inputs.incoterm === 'ddp' ? '0' : inputs.insurance) ||
      0;
    const selectedCat = categories.find((c) => c.id === inputs.categoryId) || { rate: 0.025 };

    setResults(
      calculateUKImportCosts({
        goodsValue: val,
        freight: fr,
        insurance: ins,
        dutyRate: selectedCat.rate,
        isVatRegistered: inputs.isVatRegistered,
        hasPreference: inputs.hasPreference,
      }),
    );
    setStep('results');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-blue-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-medium">Indicative estimate only</p>
          <p className="text-blue-900/85">
            Duty and VAT are modelled from category rates for planning. HMRC-confirmed amounts on
            acceptance (DMSTAX) always override this figure.
          </p>
        </div>
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Product category</label>
            <Select
              value={inputs.categoryId}
              onValueChange={(v: string) => setInputs({ ...inputs, categoryId: v })}
            >
              <SelectTrigger className={cn(fieldClass, 'px-3')}>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                {categories.map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={cat.id}
                    className="focus:bg-slate-50 focus:text-slate-900"
                  >
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Origin country</label>
              <input
                type="text"
                placeholder="e.g. CN"
                className={fieldClass}
                value={inputs.origin}
                onChange={(e) => setInputs({ ...inputs, origin: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Incoterm</label>
              <Select
                value={inputs.incoterm}
                onValueChange={(v: string) => setInputs({ ...inputs, incoterm: v })}
              >
                <SelectTrigger className={cn(fieldClass, 'px-3')}>
                  <SelectValue placeholder="Select Incoterm" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                  <SelectItem value="exw" className="focus:bg-slate-50">
                    EXW
                  </SelectItem>
                  <SelectItem value="fob" className="focus:bg-slate-50">
                    FOB
                  </SelectItem>
                  <SelectItem value="cif" className="focus:bg-slate-50">
                    CIF
                  </SelectItem>
                  <SelectItem value="ddp" className="focus:bg-slate-50">
                    DDP
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Goods value (GBP)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                £
              </span>
              <input
                type="number"
                placeholder="0.00"
                className={cn(fieldClass, 'pl-7')}
                value={inputs.goodsValue}
                onChange={(e) => setInputs({ ...inputs, goodsValue: e.target.value })}
              />
            </div>
          </div>

          {(inputs.incoterm === 'exw' || inputs.incoterm === 'fob') && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Freight</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className={fieldClass}
                  value={inputs.freight}
                  onChange={(e) => setInputs({ ...inputs, freight: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>Insurance</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className={fieldClass}
                  value={inputs.insurance}
                  onChange={(e) => setInputs({ ...inputs, insurance: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-900">Importer VAT registered?</Label>
                <p className="text-[11px] text-slate-500">Affects VAT recovery status</p>
              </div>
              <Switch
                checked={inputs.isVatRegistered}
                onCheckedChange={(v: boolean) => setInputs({ ...inputs, isVatRegistered: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-900">Preferential origin claim?</Label>
                <p className="text-[11px] text-slate-500">Apply FTA / GSP duty rates</p>
              </div>
              <Switch
                checked={inputs.hasPreference}
                onCheckedChange={(v: boolean) => setInputs({ ...inputs, hasPreference: v })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={!inputs.goodsValue}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            Calculate UK costs
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 'results' && results && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Est. duty rate</span>
                <span className="text-sm font-bold text-slate-900">
                  {(results.dutyRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Customs duty</span>
                <span className="text-sm font-semibold text-slate-900">
                  £{results.dutyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Import VAT (20%)</span>
                <span className="text-sm font-semibold text-slate-900">
                  £{results.vatAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                <span className="text-xs font-semibold text-slate-700">Total taxes (indicative)</span>
                <span className="text-base font-bold text-slate-900">
                  £{results.totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('input')}
            className="text-[10px] font-bold uppercase tracking-tight text-blue-600 hover:text-blue-700"
          >
            ← Edit calculation
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
        <span>Indicative — excludes anti-dumping and excise</span>
        <span>Source: UK Trade Tariff rates</span>
      </div>
    </div>
  );
};
