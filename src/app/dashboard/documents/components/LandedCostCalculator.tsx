"use client";

import React, { useState } from "react";
import { 
  Calculator, 
  Loader2 
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LandedCostCalculatorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LandedCostCalculator({ isOpen, onOpenChange }: LandedCostCalculatorProps) {
  const calculateLandedCost = useMutation(api.calculator.calculateLandedCost);
  const [calcForm, setCalcForm] = useState({ hsCode: "", originCountry: "", itemValue: "", shippingCost: "", dutyRate: "", vatRate: "20" });
  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await calculateLandedCost({
        hsCode: "N/A",
        originCountry: "N/A",
        itemValue: Number(calcForm.itemValue),
        shippingCost: Number(calcForm.shippingCost),
        dutyRate: Number(calcForm.dutyRate),
        vatRate: Number(calcForm.vatRate),
      });
      setCalcResult(res);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-500" />
            Landed Cost Calculator
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Value (£)</label>
              <input 
                type="number" 
                value={calcForm.itemValue} 
                onChange={(e) => setCalcForm({...calcForm, itemValue: e.target.value})} 
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs" 
                placeholder="0.00" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Shipping (£)</label>
              <input 
                type="number" 
                value={calcForm.shippingCost} 
                onChange={(e) => setCalcForm({...calcForm, shippingCost: e.target.value})} 
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs" 
                placeholder="0.00" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Duty Rate (%)</label>
              <input 
                type="number" 
                value={calcForm.dutyRate} 
                onChange={(e) => setCalcForm({...calcForm, dutyRate: e.target.value})} 
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs" 
                placeholder="0" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">VAT Rate (%)</label>
              <input 
                type="number" 
                value={calcForm.vatRate} 
                onChange={(e) => setCalcForm({...calcForm, vatRate: e.target.value})} 
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs" 
                placeholder="20" 
              />
            </div>
          </div>

          <Button 
            className="h-9 bg-black text-white hover:bg-gray-800 w-full text-xs"
            disabled={calculating || !calcForm.itemValue}
            onClick={handleCalculate}
          >
            {calculating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Calculating...
              </>
            ) : "Run Calculation"}
          </Button>

          {calcResult && (
            <div className="space-y-4 p-5 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="flex justify-between items-center pb-3 border-b border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Total Duty</span>
                <span className="text-sm font-bold text-indigo-950">£{calcResult.dutyAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-indigo-100">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Total VAT</span>
                <span className="text-sm font-bold text-indigo-950">£{calcResult.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">Landed Cost</span>
                <span className="text-lg font-bold text-indigo-950">£{calcResult.totalLandedCost.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
