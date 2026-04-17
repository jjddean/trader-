"use client";

import React, { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { 
  Globe, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  Upload,
  Calculator
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
import { cn } from "@/lib/utils";
import { docTypeName } from "@/lib/utils/document-utils";
import { api } from "../../../../../convex/_generated/api";

interface UnifiedComplianceToolProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  declarationId?: string | null;
}

interface ComplianceData {
  bestRate: {
    scheme: string;
    rate: string;
    saving: string;
    isMfn: boolean;
  };
  allRates: any[];
  documents: Array<{
    name: string;
    code: string;
    status: "READY" | "PENDING";
    type: string;
  }>;
  quota?: {
    orderNumber: string;
    balance: string;
    isExhausted: boolean;
  };
}

export function UnifiedComplianceTool({ isOpen, onOpenChange, declarationId }: UnifiedComplianceToolProps) {
  // FORM STATE
  const [selectedCountry, setSelectedCountry] = useState("");
  const [commodityCode, setCommodityCode] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  
  // UI & DATA STATE
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const upsertRequirementsForDeclaration = useMutation(api.documents.upsertRequirementsForDeclaration);

  const schemeMapping: Record<string, string> = {
    "1013": "UK-EU Trade and Cooperation Agreement",
    "JP": "UK-Japan Comprehensive Economic Partnership",
    "CA": "UK-Canada CTPA",
    "AU": "UK-Australia FTA",
    "NZ": "UK-New Zealand FTA",
    "1060": "DCTS - Standard Preferences",
    "1061": "DCTS - Enhanced Preferences",
    "1062": "DCTS - Comprehensive Preferences",
    "1011": "UK Global Tariff (MFN)",
  };

  const certMapping: Record<string, string> = {
    "N865": docTypeName("N865"),
    "N935": docTypeName("N935"),
    "U166": docTypeName("U166"),
    "U101": docTypeName("U101"),
    "U164": docTypeName("U164"),
    "9100": docTypeName("9100"),
  };

  const handleRunCheck = async () => {
    if (!selectedCountry || !commodityCode) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(`https://www.trade-tariff.service.gov.uk/api/v2/commodities/${commodityCode}?country=${selectedCountry}`);
      if (!response.ok) throw new Error("Unable to fetch tariff data. Please check that the commodity code is a valid 10-digit number.");
      
      const json = await response.json();
      const included = json.included || [];

      const findIncluded = (type: string, id: string) => included.find((item: any) => item.type === type && item.id === id);
      const relevantMeasureIds = new Set(json.data.relationships.import_measures.data.map((m: any) => String(m.id)));
      const allMeasures = included.filter((item: any) => item.type === "measure" && relevantMeasureIds.has(String(item.id)));
      
      const rates: any[] = [];
      const certificatesFound = new Set<string>();
      let mfnRateValue = 0;
      let preferencesFound = false;
      let activeQuota: any = null;

      allMeasures.forEach((measure: any) => {
        const measureTypeId = measure.relationships.measure_type.data.id;
        const geoAreaId = measure.relationships.geographical_area.data.id;
        const dutyExprId = measure.relationships.duty_expression?.data?.id;
        
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

          // EXTRACT CERTIFICATES from conditions
          const conditionIds = measure.relationships.measure_conditions?.data?.map((c: any) => String(c.id)) || [];
          conditionIds.forEach((cId: string) => {
            const condition = findIncluded("measure_condition", cId);
            const certId = condition?.relationships?.certificate?.data?.id;
            if (certId && certMapping[certId]) certificatesFound.add(certId);
          });

          // QUOTA CHECK
          const quotaNumber = measure.attributes.order_number;
          if (quotaNumber) {
            activeQuota = { orderNumber: quotaNumber };
          }

          rates.push({
            name: schemeName,
            rate: rate,
            rateValue: rateValue,
            isMfn: isMfn,
          });
        }
      });

      if (rates.length === 0) throw new Error("No applicable measures found for this commodity.");

      const sortedRates = [...rates].sort((a, b) => a.rateValue - b.rateValue);
      const best = sortedRates[0];
      const savingValue = Math.max(0, mfnRateValue - best.rateValue);

      const docsList = Array.from(certificatesFound).map(code => ({
        name: certMapping[code],
        code: code,
        status: "READY" as "READY" | "PENDING",
        type: "Proof of Origin"
      }));

      if (preferencesFound && !certificatesFound.has("9100")) {
        docsList.push({ name: "Rules of Origin Statement", code: "9100", status: "PENDING", type: "Required" });
      }

      setData({
        bestRate: {
          scheme: best.name,
          rate: best.rate,
          saving: savingValue > 0 ? `Saving: ${savingValue}% vs standard rate` : best.isMfn ? "No preference saving available" : "Same as standard rate",
          isMfn: best.isMfn
        },
        allRates: rates.sort((a, b) => (a.isMfn ? 1 : -1)),
        documents: docsList,
        quota: activeQuota
      });

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const landedCost = useMemo(() => {
    if (!data || !itemValue) return null;
    const valueNum = Number(itemValue);
    const shipNum = Number(shippingCost) || 0;
    const ratePercent = parseFloat(data.bestRate.rate.replace(/[^\d.]/g, '')) / 100 || 0;
    const duty = (valueNum + shipNum) * ratePercent;
    const vat = (valueNum + shipNum + duty) * 0.20;
    return { duty, vat, total: valueNum + shipNum + duty + vat };
  }, [data, itemValue, shippingCost]);

  const handleSaveRequirements = async () => {
    if (!data || !declarationId) return;
    try {
      setIsSavingRequirements(true);
      const advisoryCodes = new Set(["9100", "U166", "U101", "U164", "N865", "N864"]);
      await upsertRequirementsForDeclaration({
        declarationId: declarationId as any,
        requirements: data.documents.map((doc) => ({
          code: doc.code,
          name: doc.name,
          type: doc.type,
          source: "preference_tool",
          requirementLevel: advisoryCodes.has(String(doc.code).toUpperCase()) ? "advisory" : "blocking",
          deReference: "DE 2/3",
          hmrcGuidance: advisoryCodes.has(String(doc.code).toUpperCase())
            ? "Origin evidence is advisory unless procedure/agreement makes it mandatory."
            : "Required supporting document reference for declaration validation.",
        })),
      });
    } finally {
      setIsSavingRequirements(false);
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
                value={commodityCode}
                onChange={(e) => setCommodityCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handleRunCheck}
              disabled={loading || !selectedCountry || commodityCode.length < 10}
              className="w-full bg-black text-white hover:bg-gray-800 h-9 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking Tariff...
                </>
              ) : "Check Preferences"}
            </Button>
          </div>

          {error && (
            <div className="p-6 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3 relative animate-in fade-in">
              <button className="absolute top-2 right-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600">forms</button>
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium pr-10">{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 ml-1">Best Available Rate</h3>
                <div className="p-5 rounded-xl bg-green-50 border border-green-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">Recommended Scheme</p>
                      <h4 className="text-[15px] font-bold text-green-900 leading-tight">{data.bestRate.scheme}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">Duty Rate</p>
                      <p className="text-[18px] font-bold text-green-900 tabular-nums">{data.bestRate.rate}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-green-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-green-700">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold">{data.bestRate.saving}</span>
                    </div>
                    {data.quota && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] uppercase font-bold">Quota: {data.quota.orderNumber}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* AVAILABLE DOCUMENTS */}
              <div>
                <div className="mb-3 ml-1 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Available Documents</h3>
                  {declarationId ? (
                    <Button
                      onClick={handleSaveRequirements}
                      disabled={isSavingRequirements}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                    >
                      {isSavingRequirements ? "Saving..." : "Save as Required Docs"}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-gray-400">Select a declaration filter to persist</span>
                  )}
                </div>
                <div className="space-y-2">
                  {data.documents.length > 0 ? data.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 transition-colors hover:border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-gray-50 flex items-center justify-center text-gray-400">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-gray-900">{doc.name}</p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider font-medium">{doc.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn(
                          "text-[9px] font-bold tracking-widest rounded px-2 py-0.5",
                          doc.status === "READY" ? "bg-green-100 text-green-700 border-green-100" : "bg-amber-100 text-amber-700 border-amber-100"
                        )}>
                          {doc.status}
                        </Badge>
                        <div className="flex items-center gap-1 text-gray-300">
                          <Download className="h-3.5 w-3.5 cursor-pointer hover:text-gray-900" />
                          <Upload className="h-3.5 w-3.5 cursor-pointer hover:text-gray-900" />
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-[11px] text-gray-500 italic ml-1">No special certificates required for this route.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
