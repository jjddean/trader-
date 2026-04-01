"use client";

import React, { useState } from "react";
import { 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/lib/data/countries";

interface PreferenceCheckerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreferenceChecker({ isOpen, onOpenChange }: PreferenceCheckerProps) {
  const [selectedCountry, setSelectedCountry] = useState("");
  const [prefCommodityCode, setPrefCommodityCode] = useState("");
  const [prefResults, setPrefResults] = useState<any | null>(null);
  const [isPrefLoading, setIsPrefLoading] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);

  const handlePreferenceSubmit = async () => {
    if (!selectedCountry || !prefCommodityCode) return;
    setIsPrefLoading(true);
    setPrefError(null);
    setPrefResults(null);

    const schemeMapping: Record<string, string> = {
      "1013": "UK-EU Trade and Cooperation Agreement",
      "JP": "UK-Japan Comprehensive Economic Partnership",
      "CA": "UK-Canada CTPA",
      "AU": "UK-Australia FTA",
      "NZ": "UK-New Zealand FTA",
      "1060": "DCTS - Standard Preferences",
      "1061": "DCTS - Enhanced Preferences",
      "1062": "DCTS - Comprehensive Preferences",
      "1011": "UK Global Tariff MFN",
    };

    try {
      const response = await fetch(`https://www.trade-tariff.service.gov.uk/api/v2/commodities/${prefCommodityCode}?country=${selectedCountry}`);
      if (!response.ok) throw new Error("Unable to fetch tariff data. Please check that the commodity code is a valid 10-digit number.");
      
      const json = await response.json();
      const included = json.included || [];

      const relevantMeasureIds = new Set(json.data.relationships.import_measures.data.map((m: any) => String(m.id)));
      const findIncluded = (type: string, id: string) => included.find((item: any) => item.type === type && item.id === id);
      const allMeasures = included.filter((item: any) => item.type === "measure" && relevantMeasureIds.has(String(item.id)));
      
      const results: any[] = [];
      let mfnRateValue = 0;
      let preferencesFound = false;

      allMeasures.forEach((measure: any) => {
        const measureTypeId = measure.relationships.measure_type.data.id;
        const geoAreaId = measure.relationships.geographical_area.data.id;
        const dutyExprId = measure.relationships.duty_expression.data.id;
        
        const geoArea = findIncluded("geographical_area", geoAreaId);
        const dutyExpr = findIncluded("duty_expression", dutyExprId);
        
        const children = geoArea?.relationships?.children_geographical_areas?.data || [];
        const isChild = children.some((c: any) => c.id === selectedCountry);

        const isRelevantGeo = (geoAreaId === selectedCountry || geoAreaId === "1011" || isChild);

        if (isRelevantGeo && (measureTypeId === "103" || measureTypeId === "142")) {
          const rate = dutyExpr?.attributes?.base || "0.00 %";
          const rateValue = parseFloat(rate.replace(/[^\d.]/g, '')) || 0;
          const schemeName = schemeMapping[geoAreaId] || geoArea?.attributes?.description || `Scheme ${geoAreaId}`;

          const isMfn = measureTypeId === "103";
          if (isMfn) mfnRateValue = rateValue;
          if (!isMfn) preferencesFound = true;

          results.push({
            name: schemeName,
            rate: rate,
            rateValue: rateValue,
            eligible: true,
            isMfn: isMfn,
            notes: "" 
          });
        }
      });

      if (results.length === 0) {
        throw new Error("No applicable measures found for this commodity.");
      }

      const sorted = [...results].sort((a, b) => a.rateValue - b.rateValue);
      const best = sorted[0];
      
      const savingValue = Math.max(0, mfnRateValue - best.rateValue);
      let savingText = savingValue > 0 
        ? `Saving: ${savingValue}% vs standard rate` 
        : best.isMfn ? "No preference saving available" : "Same as standard rate";
      
      if (!preferencesFound) {
        savingText = "No preference schemes available for this origin. Standard MFN rate applies.";
      }

      setPrefResults({
        best: {
          scheme: best.name,
          rate: best.rate,
          saving: savingText
        },
        all: results.sort((a, b) => (a.isMfn ? 1 : -1)) 
      });

    } catch (err: any) {
      setPrefError(err.message || "An unexpected error occurred");
    } finally {
      setIsPrefLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Preference Checker
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Country of Origin
              </label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none">
                  <SelectValue placeholder="Choose a country..." />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] z-[110]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Commodity Code
              </label>
              <input
                type="text"
                placeholder="e.g. 0101210000"
                value={prefCommodityCode}
                onChange={(e) => setPrefCommodityCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <Button 
            onClick={handlePreferenceSubmit}
            disabled={isPrefLoading || !selectedCountry || prefCommodityCode.length < 10}
            className="w-full bg-black text-white hover:bg-gray-800 h-9 text-xs"
          >
            {isPrefLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking Tariff...
              </>
            ) : "Check Preferences"}
          </Button>

          {prefError && (
            <div className="p-6 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3 relative">
              <button className="absolute top-2 right-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors">
                forms
              </button>
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium pr-10">{prefError}</p>
            </div>
          )}

          {prefResults && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Best Available Rate</h3>
                <div className="p-5 rounded-xl bg-green-50 border border-green-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">Recommended Scheme</p>
                      <h4 className="text-lg font-bold text-green-900">{prefResults.best.scheme}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">Duty Rate</p>
                      <p className="text-2xl font-bold text-green-900">{prefResults.best.rate}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-green-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-green-700">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold">{prefResults.best.saving}</span>
                    </div>
                    <Badge className="bg-green-600 text-white border-0 text-[10px] px-2 py-0">Active</Badge>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">All Available Preferences</h3>
                <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 font-semibold text-gray-600">SCHEME</th>
                        <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">RATE</th>
                        <th className="px-4 py-2.5 font-semibold text-gray-600 text-center">ELIGIBLE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {prefResults.all.map((scheme: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{scheme.name}</div>
                            {scheme.notes && <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{scheme.notes}</div>}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-gray-700">
                            {scheme.rate}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {scheme.eligible ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
