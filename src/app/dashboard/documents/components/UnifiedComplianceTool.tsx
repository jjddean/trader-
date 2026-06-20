"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  Globe,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  FileText,
  Download,
  Upload,
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
import { getPreferenceDecision } from "@/lib/preference-engine";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

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
    dutyAmount: number;
    preferenceCodeId: string | null;
  };
  allRates: Array<{
    name: string;
    rate: string;
    dutyAmount: number;
    isMfn: boolean;
    preferenceCodeId: string | null;
    incompleteInput: boolean;
  }>;
  documents: Array<{
    name: string;
    code: string;
    status: "READY" | "PENDING";
    type: string;
  }>;
  quota?: {
    orderNumber: string;
  };
  estimateLabel: string;
}

function asDeclarationId(value: string | null | undefined): Id<"declarations"> | null {
  if (!value || value === "all") return null;
  return value as Id<"declarations">;
}

export function UnifiedComplianceTool({ isOpen, onOpenChange, declarationId }: UnifiedComplianceToolProps) {
  const declarationRef = asDeclarationId(declarationId);
  const declarationItems = useQuery(
    api.goods_items.getItems,
    declarationRef && isOpen ? { declarationId: declarationRef } : "skip",
  );

  const [selectedCountry, setSelectedCountry] = useState("");
  const [commodityCode, setCommodityCode] = useState("");
  const [itemValue, setItemValue] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [netWeightKg, setNetWeightKg] = useState("");
  const [selectedItemKey, setSelectedItemKey] = useState<string>("manual");

  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);
  const upsertRequirementsForDeclaration = useMutation(api.documents.upsertRequirementsForDeclaration);

  const certMapping: Record<string, string> = {
    N865: docTypeName("N865"),
    N935: docTypeName("N935"),
    U166: docTypeName("U166"),
    U101: docTypeName("U101"),
    U164: docTypeName("U164"),
    "9100": docTypeName("9100"),
  };

  const itemOptions = useMemo(() => {
    if (!declarationItems?.length) return [];
    return declarationItems.map((item, index) => ({
      key: String(item._id || index),
      label: `Item ${item.sequenceNumber || index + 1} — ${item.commodityCode || "No HS code"}`,
      item,
    }));
  }, [declarationItems]);

  function applyItemToForm(item: (typeof itemOptions)[number]["item"]) {
    setSelectedCountry(String(item.originCountry || "").toUpperCase());
    setCommodityCode(String(item.commodityCode || "").replace(/\D/g, "").slice(0, 10));
    setItemValue(item.valueAmount != null ? String(item.valueAmount) : "");
    setNetWeightKg(item.netWeightKg != null ? String(item.netWeightKg) : "");
  }

  useEffect(() => {
    if (!isOpen) return;
    if (!declarationRef || !itemOptions.length) return;
    const first = itemOptions[0];
    setSelectedItemKey(first.key);
    applyItemToForm(first.item);
  }, [isOpen, declarationRef, itemOptions]);

  useEffect(() => {
    if (!isOpen) {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen]);

  const handleItemSelection = (key: string) => {
    setSelectedItemKey(key);
    if (key === "manual") return;
    const match = itemOptions.find((option) => option.key === key);
    if (match) applyItemToForm(match.item);
  };

  const handleRunCheck = async () => {
    if (!selectedCountry || commodityCode.length < 10) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const result = await getPreferenceDecision({
        country: selectedCountry,
        commodityCode,
        customsValueGbp: Number(itemValue) || 0,
        netWeightKg: netWeightKg ? Number(netWeightKg) : undefined,
      });

      const preferencesFound = result.all.some((r) => !r.isMfn);
      const docsList: ComplianceData["documents"] = result.certificates
        .filter((code) => certMapping[code])
        .map((code) => ({
          name: certMapping[code],
          code,
          status: "READY" as const,
          type: "Proof of Origin",
        }));

      if (preferencesFound && !result.certificates.includes("9100")) {
        docsList.push({
          name: "Rules of Origin Statement",
          code: "9100",
          status: "PENDING",
          type: "Required",
        });
      }

      setData({
        bestRate: result.best,
        allRates: result.all.map((row) => ({
          name: row.name,
          rate: row.rate,
          dutyAmount: row.dutyAmount,
          isMfn: row.isMfn,
          preferenceCodeId: row.preferenceCodeId,
          incompleteInput: row.incompleteInput,
        })),
        documents: docsList,
        quota: result.quota ?? undefined,
        estimateLabel: result.estimateLabel,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const landedCost = useMemo(() => {
    if (!data || !itemValue) return null;
    const valueNum = Number(itemValue);
    const shipNum = Number(shippingCost) || 0;
    const customsValue = valueNum + shipNum;
    const duty = data.bestRate.dutyAmount;
    const vat = (customsValue + duty) * 0.2;
    return { duty, vat, total: customsValue + duty + vat };
  }, [data, itemValue, shippingCost]);

  const handleSaveRequirements = async () => {
    if (!data || !declarationRef) return;
    try {
      setIsSavingRequirements(true);
      const advisoryCodes = new Set(["9100", "U166", "U101", "U164", "N865", "N864"]);
      await upsertRequirementsForDeclaration({
        declarationId: declarationRef,
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
          {declarationRef && itemOptions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Declaration item
              </label>
              <Select value={selectedItemKey} onValueChange={handleItemSelection}>
                <SelectTrigger className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700">
                  <SelectValue placeholder="Choose an item..." />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[110]">
                  {itemOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="manual" className="text-xs">
                    Manual entry
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
                onChange={(e) => setCommodityCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Item value (GBP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemValue}
                  onChange={(e) => setItemValue(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Shipping (GBP)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Net weight (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={netWeightKg}
                  onChange={(e) => setNetWeightKg(e.target.value)}
                  placeholder="Required for weight-based duty"
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-700"
                />
              </div>
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
              ) : (
                "Check Preferences"
              )}
            </Button>
          </div>

          {error && (
            <div className="p-6 rounded-lg bg-red-50 border border-red-100 flex items-start gap-3 relative animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-800 font-medium pr-10">{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                {data.estimateLabel}
              </p>

              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 ml-1">
                  Best Available Rate
                </h3>
                <div className="p-5 rounded-xl bg-green-50 border border-green-100">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">
                        Recommended Scheme
                      </p>
                      <h4 className="text-[15px] font-bold text-green-900 leading-tight">{data.bestRate.scheme}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.625rem] font-semibold text-green-700 uppercase tracking-wider mb-1">
                        Duty Rate
                      </p>
                      <p className="text-[18px] font-bold text-green-900 tabular-nums">{data.bestRate.rate}</p>
                      <p className="text-[11px] text-green-800 tabular-nums">£{data.bestRate.dutyAmount.toFixed(2)} est.</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-green-200/50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-green-700">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold">{data.bestRate.saving}</span>
                    </div>
                    {data.quota && (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] uppercase font-bold">
                        Quota: {data.quota.orderNumber}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {landedCost && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-xs space-y-1">
                  <p className="font-semibold text-gray-900">Indicative landed cost</p>
                  <div className="flex justify-between text-gray-600">
                    <span>Estimated duty</span>
                    <span className="tabular-nums">£{landedCost.duty.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Estimated VAT (20%)</span>
                    <span className="tabular-nums">£{landedCost.vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                    <span>Total</span>
                    <span className="tabular-nums">£{landedCost.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-3 ml-1 flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Available Documents</h3>
                  {declarationRef ? (
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
                    <span className="text-[10px] text-gray-400">Filter by declaration to persist</span>
                  )}
                </div>
                <div className="space-y-2">
                  {data.documents.length > 0 ? (
                    data.documents.map((doc, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 transition-colors hover:border-gray-200"
                      >
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
                          <Badge
                            className={cn(
                              "text-[9px] font-bold tracking-widest rounded px-2 py-0.5",
                              doc.status === "READY"
                                ? "bg-green-100 text-green-700 border-green-100"
                                : "bg-amber-100 text-amber-700 border-amber-100",
                            )}
                          >
                            {doc.status}
                          </Badge>
                          <div className="flex items-center gap-1 text-gray-300">
                            <Download className="h-3.5 w-3.5 cursor-pointer hover:text-gray-900" />
                            <Upload className="h-3.5 w-3.5 cursor-pointer hover:text-gray-900" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-gray-500 italic ml-1">
                      No special certificates required for this route.
                    </p>
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
