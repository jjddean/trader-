"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Info } from "lucide-react";
import { countries } from "@/lib/data/countries";

export default function CoreSchemaPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  
  const declaration = useQuery(
    api.declarations.getLane,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { id } : "skip",
  );
  const updateDeclaration = useMutation(api.declarations.updateDeclarationDetails);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    eori: "",
    declarationType: "H1",
    route: "Route 1",
    dispatchCountry: "",
    transportMode: "",
    transportId: "",
    transportIdType: "",
  });

  // Hydrate form once data loads
  React.useEffect(() => {
    if (declaration) {
      setFormData({
        eori: declaration.eori || "",
        declarationType: "H1",
        route: declaration.route || "Route 1",
        dispatchCountry: (declaration as Record<string, unknown>).dispatchCountry as string || "",
        transportMode: (declaration as Record<string, unknown>).transportMode as string || "",
        transportId: (declaration as Record<string, unknown>).transportId as string || "",
        transportIdType: (declaration as Record<string, unknown>).transportIdType as string || "",
      });
    }
  }, [declaration]);

  const handleSave = async () => {
    if (!formData.eori) return;
    setSaving(true);
    try {
      await updateDeclaration({
        id,
        eori: formData.eori,
        declarationType: formData.declarationType,
        route: formData.route,
        dispatchCountry: formData.dispatchCountry || undefined,
        transportMode: formData.transportMode || undefined,
        transportId: formData.transportId || undefined,
        transportIdType: formData.transportIdType || undefined,
      });
    } catch (e) {
      console.error("Failed to save core schema", e);
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded || isConvexAuthLoading || !declaration) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Core Declaration Details</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter the core details for this CDS import declaration.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="p-6 space-y-6">
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            
            {/* EORI Number */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Declarant EORI
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.eori}
                onChange={(e) => setFormData({ ...formData, eori: e.target.value })}
                placeholder="e.g. GB123456789000"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Must match your HMRC Developer Hub credentials.
              </p>
            </div>

            {/* Declaration Category */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Declaration Category
                <span className="text-red-500">*</span>
              </label>
              <Select 
                value={formData.declarationType}
                onValueChange={(val) => setFormData({ ...formData, declarationType: val })}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="H1">H1 (Release for Free Circulation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Routing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Customs Routing
              </label>
              <Select
                value={formData.route}
                onValueChange={(val) => setFormData({ ...formData, route: val })}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Route 1">Route 1 (Documentary Check)</SelectItem>
                  <SelectItem value="Route 2">Route 2 (Physical Exam)</SelectItem>
                  <SelectItem value="Route 6">Route 6 (Direct Clearance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch Country — DE 5/14 ExportCountry */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Dispatch Country (DE 5/14)
                <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.dispatchCountry}
                onValueChange={(val) => setFormData({ ...formData, dispatchCountry: val })}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Country goods shipped FROM" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Country goods were shipped FROM — never GB for a third-country import.
              </p>
            </div>

          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-medium text-gray-900">Transport Identity</h3>
            <p className="mt-1 text-[11px] text-gray-500">
              DE 7/4 (mode), DE 7/7 / 7/9 (border / arrival means). CDS rejects mismatched or stale values — use the actual vessel/IMO/wagon/vehicle/flight identifier for this consignment.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Transport Mode (DE 7/4)
                </label>
                <Select
                  value={formData.transportMode}
                  onValueChange={(val) => setFormData({ ...formData, transportMode: val })}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Sea</SelectItem>
                    <SelectItem value="2">2 — Rail</SelectItem>
                    <SelectItem value="3">3 — Road</SelectItem>
                    <SelectItem value="4">4 — Air</SelectItem>
                    <SelectItem value="5">5 — Postal</SelectItem>
                    <SelectItem value="7">7 — Fixed transport installations</SelectItem>
                    <SelectItem value="8">8 — Inland waterway</SelectItem>
                    <SelectItem value="9">9 — Mode unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Identification Type (DE 7/7)
                </label>
                <Select
                  value={formData.transportIdType}
                  onValueChange={(val) => setFormData({ ...formData, transportIdType: val })}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select identifier type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 — IMO ship identification number</SelectItem>
                    <SelectItem value="11">11 — Name of seagoing vessel</SelectItem>
                    <SelectItem value="20">20 — Wagon number</SelectItem>
                    <SelectItem value="30">30 — Vehicle registration number</SelectItem>
                    <SelectItem value="40">40 — IATA flight number</SelectItem>
                    <SelectItem value="41">41 — Registration of aircraft</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Identification (DE 7/9)
                </label>
                <input
                  type="text"
                  value={formData.transportId}
                  onChange={(e) => setFormData({ ...formData, transportId: e.target.value })}
                  placeholder="e.g. IMO9395044, vessel name, vehicle reg"
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
                />
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Real identifier for this consignment. Don&apos;t carry over a value from a previous declaration.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="border-t border-gray-100 bg-gray-50/50 p-4 px-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !formData.eori}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Core Details
          </button>
        </div>
      </div>
    </div>
  );
}
