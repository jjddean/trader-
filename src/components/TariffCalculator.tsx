'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, ArrowRight, Info, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { fetchTradeData, calculateUKImportCosts, TariffCategory } from '@/lib/trade-data';

export const TariffCalculator = () => {
    const [step, setStep] = useState<'input' | 'results' | 'success'>('input');
    const [categories, setCategories] = useState<TariffCategory[]>([]);
    const [inputs, setInputs] = useState({
        product: '',
        categoryId: 'general',
        origin: 'CN',
        goodsValue: '',
        incoterm: 'fob',
        freight: '',
        insurance: '',
        isVatRegistered: true,
        hasPreference: false
    });

    const [results, setResults] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchTradeData().then(data => setCategories(data.categories));
    }, []);

    const handleCalculate = () => {
        const val = parseFloat(inputs.goodsValue) || 0;
        const fr = parseFloat(inputs.incoterm === 'cif' || inputs.incoterm === 'ddp' ? '0' : inputs.freight) || 0;
        const ins = parseFloat(inputs.incoterm === 'cif' || inputs.incoterm === 'ddp' ? '0' : inputs.insurance) || 0;

        const selectedCat = categories.find(c => c.id === inputs.categoryId) || { rate: 0.025 };

        const costs = calculateUKImportCosts({
            goodsValue: val,
            freight: fr,
            insurance: ins,
            dutyRate: selectedCat.rate,
            isVatRegistered: inputs.isVatRegistered,
            hasPreference: inputs.hasPreference
        });

        setResults(costs);
        setStep('results');
    };

    return (
        <Card className="max-w-md mx-auto bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 text-slate-900 py-6 px-8 relative border-b border-slate-100">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center border border-blue-100 flex-shrink-0">
                        <Calculator className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl font-bold tracking-tight text-slate-900 m-0">
                        {step === 'success' ? 'Profile Setup' : 'UK Import Cost Calculator'}
                    </CardTitle>
                </div>
                <p className="text-slate-500 text-xs leading-relaxed font-medium">
                    {step === 'results' ? 'Indicative Landing Cost Estimate' : 'Estimate Import Duty, VAT & Clearance costs in seconds.'}
                </p>
            </CardHeader>

            <CardContent className="p-8 pt-10 bg-white">
                {step === 'input' && (
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Product Category</label>
                            <Select value={inputs.categoryId} onValueChange={(v: string) => setInputs({ ...inputs, categoryId: v })}>
                                <SelectTrigger className="bg-white border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-blue-500">
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.id} className="focus:bg-slate-50 focus:text-slate-900">{cat.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Origin Country</label>
                                <Input
                                    placeholder="e.g. China"
                                    className="bg-white border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-blue-500"
                                    value={inputs.origin}
                                    onChange={(e) => setInputs({ ...inputs, origin: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Incoterm</label>
                                <Select value={inputs.incoterm} onValueChange={(v: string) => setInputs({ ...inputs, incoterm: v })}>
                                    <SelectTrigger className="bg-white border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-blue-500">
                                        <SelectValue placeholder="Select Incoterm" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200 text-slate-900 shadow-lg">
                                        <SelectItem value="exw" className="focus:bg-slate-50 focus:text-slate-900">EXW</SelectItem>
                                        <SelectItem value="fob" className="focus:bg-slate-50 focus:text-slate-900">FOB</SelectItem>
                                        <SelectItem value="cif" className="focus:bg-slate-50 focus:text-slate-900">CIF</SelectItem>
                                        <SelectItem value="ddp" className="focus:bg-slate-50 focus:text-slate-900">DDP</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Goods Value (GBP)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">£</span>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="bg-white border-slate-200 text-slate-900 h-12 pl-10 rounded-xl font-bold focus:ring-blue-500"
                                    value={inputs.goodsValue}
                                    onChange={(e) => setInputs({ ...inputs, goodsValue: e.target.value })}
                                />
                            </div>
                        </div>

                        {(inputs.incoterm === 'exw' || inputs.incoterm === 'fob') && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Freight Cost</label>
                                    <Input
                                        type="number"
                                        placeholder="£"
                                        className="bg-white border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-blue-500"
                                        value={inputs.freight}
                                        onChange={(e) => setInputs({ ...inputs, freight: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Insurance</label>
                                    <Input
                                        type="number"
                                        placeholder="£"
                                        className="bg-white border-slate-200 text-slate-900 h-12 rounded-xl focus:ring-blue-500"
                                        value={inputs.insurance}
                                        onChange={(e) => setInputs({ ...inputs, insurance: e.target.value })}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-4 py-2 border-t border-slate-100 mt-2">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-slate-900">Importer VAT registered?</Label>
                                    <p className="text-[9px] text-slate-500">Affects VAT recovery status</p>
                                </div>
                                <Switch
                                    checked={inputs.isVatRegistered}
                                    onCheckedChange={(v: boolean) => setInputs({ ...inputs, isVatRegistered: v })}
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-xs font-bold text-slate-900">Preferential origin claim?</Label>
                                    <p className="text-[9px] text-slate-500">Apply FTA / GSP duty rates</p>
                                </div>
                                <Switch
                                    checked={inputs.hasPreference}
                                    onCheckedChange={(v: boolean) => setInputs({ ...inputs, hasPreference: v })}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleCalculate}
                            className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl mt-4 shadow-md shadow-blue-500/20"
                            disabled={!inputs.goodsValue}
                        >
                            Calculate UK Costs
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )}

                {step === 'results' && results && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-4 shadow-inner">
                            <div className="flex justify-between items-center pb-3 border-b border-blue-100/50">
                                <span className="text-xs text-slate-500 font-medium">Est. UK Duty Rate</span>
                                <span className="text-lg font-bold text-slate-900">{(results.dutyRate * 100).toFixed(1)}%</span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Customs Duty</span>
                                    <span className="text-slate-900 font-semibold">£{results.dutyAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Import VAT (20%)</span>
                                    <span className="text-slate-900 font-semibold">£{results.vatAmount.toLocaleString()}</span>
                                </div>
                                <div className="pt-3 border-t border-blue-100/50 flex justify-between items-baseline">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Total Taxes Due</span>
                                    <span className="text-2xl font-bold text-slate-900">£{results.totalTaxes.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Clearance Readiness Checklist</p>
                            <div className="grid grid-cols-1 gap-2">
                                {[
                                    'Commercial Invoice',
                                    'Packing List',
                                    'Proof of Origin (for preference)',
                                    'EORI Number'
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        <span className="text-[11px] font-medium text-slate-700">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button
                                onClick={() => setStep('success')}
                                className="w-full h-14 bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 font-bold rounded-xl shadow-sm"
                            >
                                Start Import Profile Setup
                                <ArrowRight className="ml-2 h-4 w-4 text-slate-400" />
                            </Button>
                            <button
                                onClick={() => setStep('input')}
                                className="text-xs text-slate-500 hover:text-slate-700 font-medium py-1 transition-colors"
                            >
                                ← Edit Calculation
                            </button>
                        </div>
                    </div>
                )}

                {step === 'success' && (
                    <div className="text-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-slate-900 font-bold text-xl tracking-tight">Profile Initiated</h3>
                            <p className="text-slate-500 text-sm leading-relaxed mx-auto max-w-[280px]">
                                We've queued your export for our compliance team. You'll receive an email to finalize your UK Import Profile.
                            </p>
                        </div>
                        <Button
                            onClick={() => setStep('input')}
                            className="bg-transparent text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
                        >
                            Reset Calculator
                        </Button>
                    </div>
                )}

                <div className="flex gap-3 items-start pt-6 border-t border-slate-100 mt-6">
                    <Info className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[9px] text-slate-500 leading-relaxed font-medium">
                        Estimates are indicative and exclude potential anti-dumping duties or commodity-specific excise. Final liability depends on formal HMRC declaration.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
