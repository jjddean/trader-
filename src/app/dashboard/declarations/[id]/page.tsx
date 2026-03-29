"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Info } from "lucide-react";

export default function CoreSchemaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as Id<"declarations">;
  
  const declaration = useQuery(api.declarations.getLane, id ? { id } : "skip");
  const updateDeclaration = useMutation(api.declarations.updateDeclarationDetails);

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    eori: "",
    declarationType: "H1",
    route: "Route 1",
  });

  // Hydrate form once data loads
  React.useEffect(() => {
    if (declaration) {
      setFormData({
        eori: declaration.eori || "",
        declarationType: "H1",
        route: declaration.route || "Route 1",
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
      });
    } catch (e) {
      console.error("Failed to save core schema", e);
    } finally {
      setSaving(false);
    }
  };

  if (!declaration) {
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
