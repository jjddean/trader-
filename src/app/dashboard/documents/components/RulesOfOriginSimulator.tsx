"use client";

import React, { useState } from "react";
import { 
  Package, 
  CheckCircle2, 
  XCircle, 
  Loader2 
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries } from "@/lib/data/countries";
import { cn } from "@/lib/utils";

interface RulesOfOriginSimulatorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RulesOfOriginSimulator({ isOpen, onOpenChange }: RulesOfOriginSimulatorProps) {
  const simulateRoO = useMutation(api.compliance.simulateRoO);
  const [rooForm, setRooForm] = useState({ originCountry: "", commodityCode: "", valueOrigin: "", valueUK: "", valueThirdParty: "" });
  const [rooResult, setRooResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await simulateRoO({
        originCountry: rooForm.originCountry,
        commodityCode: "N/A",
        valueOrigin: Number(rooForm.valueOrigin),
        valueUK: Number(rooForm.valueUK),
        valueThirdParty: Number(rooForm.valueThirdParty),
      });
      setRooResult(res);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            Rules of Origin (RoO)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Origin Country</label>
              <Select 
                value={rooForm.originCountry} 
                onValueChange={(val) => setRooForm({...rooForm, originCountry: val})}
              >
                <SelectTrigger className="h-9 w-full rounded-md border-gray-200 bg-gray-50 text-xs text-gray-700 transition-colors focus:border-gray-400 focus:outline-none">
                  <SelectValue placeholder="Origin..." />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px] z-[110]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.name} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Value Origin (£)</label>
                <input 
                  type="number"
                  value={rooForm.valueOrigin}
                  onChange={(e) => setRooForm({...rooForm, valueOrigin: e.target.value})}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Value UK (£)</label>
                <input 
                  type="number"
                  value={rooForm.valueUK}
                  onChange={(e) => setRooForm({...rooForm, valueUK: e.target.value})}
                  className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">3rd Party Materials (£)</label>
              <input 
                type="number"
                value={rooForm.valueThirdParty}
                onChange={(e) => setRooForm({...rooForm, valueThirdParty: e.target.value})}
                className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 text-xs outline-none focus:border-blue-500"
                placeholder="0.00"
              />
            </div>
          </div>

          <Button 
            className="h-9 bg-black text-white hover:bg-gray-800 w-full text-xs"
            disabled={simulating || !rooForm.originCountry}
            onClick={handleSimulate}
          >
            {simulating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Simulating...
              </>
            ) : "Simulate Origin Eligibility"}
          </Button>

          {rooResult && (
            <div className={cn(
              "p-6 rounded-lg border text-xs leading-relaxed relative",
              rooResult.isCompliant ? "bg-green-50 border-green-100 text-green-900" : "bg-red-50 border-red-100 text-red-900"
            )}>
              {!rooResult.isCompliant && (
                <button className="absolute top-2 right-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-600 transition-colors">
                  forms
                </button>
              )}
              <div className={cn("flex items-center gap-2 font-bold mb-2 uppercase tracking-tight", !rooResult.isCompliant && "pr-10")}>
                {rooResult.isCompliant ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {rooResult.isCompliant ? "Compliant" : "Non-Compliant"}
              </div>
              {rooResult.message}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
