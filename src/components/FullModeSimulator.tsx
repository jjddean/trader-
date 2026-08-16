'use client';

import React, { useState } from 'react';
import { ArrowRight, Info, Loader2, Search } from 'lucide-react';
import { fetchTradeData, calculateUKImportCosts } from '@/lib/trade-data';
import { cn } from '@/lib/utils';
import { searchTariff } from "@/lib/tariff-search-client";

const fieldClass =
  'h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400';

const labelClass = 'mb-1.5 block text-xs font-medium text-slate-600';

export const FullModeSimulator = () => {
  const [step, setStep] = useState<'audit' | 'results'>('audit');
  const [data, setData] = useState({
    hs: '',
    value: '',
    origin: 'CN',
    freight: '',
    insurance: '',
  });
  const [hsInfo, setHsInfo] = useState<{ code: string; desc: string } | null>(null);
  const [results, setResults] = useState<
    (ReturnType<typeof calculateUKImportCosts> & { hsDesc: string }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingHs, setIsSearchingHs] = useState(false);

  const handleHsSearch = async (val: string) => {
    setData({ ...data, hs: val });
    if (val.length >= 4) {
      setIsSearchingHs(true);
      try {
        const found = await searchTariff(val);
        if (found && found.length > 0) {
          setHsInfo({
            code: found[0].code,
            desc: found[0].description,
          });
        } else {
          setHsInfo(null);
        }
      } catch {
        setHsInfo(null);
      } finally {
        setIsSearchingHs(false);
      }
    } else {
      setHsInfo(null);
    }
  };

  const handleAudit = async () => {
    setIsLoading(true);
    try {
      const tradeData = await fetchTradeData();
      const baseRate = tradeData.hs_overrides[data.hs.substring(0, 4)] ?? 0.025;

      const costs = calculateUKImportCosts({
        goodsValue: parseFloat(data.value) || 0,
        freight: parseFloat(data.freight) || 0,
        insurance: parseFloat(data.insurance) || 0,
        dutyRate: baseRate,
        isVatRegistered: true,
        hasPreference: false,
      });

      setResults({
        ...costs,
        hsDesc: hsInfo?.desc || 'General merchandise',
      });
      setStep('results');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2.5 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-blue-950">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="font-medium">HS-based estimate</p>
          <p className="text-blue-900/85">
            Enter a commodity code to model duty and VAT. Results are indicative — final liability
            depends on the formal HMRC declaration.
          </p>
        </div>
      </div>

      {step === 'audit' && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Commodity HS code</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by HS code, e.g. 6403"
                className={cn(fieldClass, 'pl-9 pr-10 font-mono tracking-wide')}
                value={data.hs}
                onChange={(e) => void handleHsSearch(e.target.value)}
              />
              {isSearchingHs && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
              )}
            </div>
            {hsInfo && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                <span className="font-bold text-blue-700">{hsInfo.code}</span>
                {' — '}
                {hsInfo.desc}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Origin territory</label>
              <input
                type="text"
                placeholder="e.g. CN"
                className={fieldClass}
                value={data.origin}
                onChange={(e) => setData({ ...data, origin: e.target.value })}
              />
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
                  value={data.value}
                  onChange={(e) => setData({ ...data, value: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Freight</label>
              <input
                type="number"
                placeholder="0.00"
                className={fieldClass}
                value={data.freight}
                onChange={(e) => setData({ ...data, freight: e.target.value })}
              />
            </div>
            <div>
              <label className={labelClass}>Insurance</label>
              <input
                type="number"
                placeholder="0.00"
                className={fieldClass}
                value={data.insurance}
                onChange={(e) => setData({ ...data, insurance: e.target.value })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleAudit()}
            disabled={!data.hs || !data.value || isLoading}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating…
              </>
            ) : (
              <>
                Calculate duty &amp; VAT
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}

      {step === 'results' && results && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold tracking-tight text-blue-700">{data.hs}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{results.hsDesc}</p>
            </div>
            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Duty rate</span>
                <span className="text-sm font-bold text-slate-900">
                  {(results.dutyRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Customs value</span>
                <span className="text-sm font-semibold text-slate-900">
                  £{results.customsValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Import duty</span>
                <span className="text-sm font-semibold text-slate-900">
                  £{results.dutyAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-slate-500">Import VAT</span>
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
            onClick={() => setStep('audit')}
            className="text-[10px] font-bold uppercase tracking-tight text-blue-600 hover:text-blue-700"
          >
            ← Run another estimate
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-400">
        <span>Indicative — HMRC confirmed amounts override on acceptance</span>
        <span>Source: HMRC Trade Tariff</span>
      </div>
    </div>
  );
};
