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
import {
  GOODS_LOCATION_KIND_OPTIONS,
  inferGoodsLocationKind,
  PORT_LOCATION_NAME_BY_ID,
  type GoodsLocationKind,
} from "@/lib/goods-location";
import { DeclarationModePromote } from "@/components/declaration-mode-promote";

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

  const completeness = useQuery(
    api.declaration_completeness.getStatus,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && id ? { declarationId: id } : "skip",
  );

  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    eori: "",
    declarationType: "H1",
    route: "Route 1",
    dispatchCountry: "",
    transportMode: "",
    transportId: "",
    transportIdType: "",
    destinationCountry: "",
    importerEori: "",
    invoiceCurrency: "",
    invoiceTotal: "",
    incoterms: "",
    incotermLocation: "",
    goodsLocationKind: "" as GoodsLocationKind | "",
    locationId: "",
    presentationOffice: "",
  });

  // Hydrate form once data loads. Missing fields stay empty — no defaults.
  React.useEffect(() => {
    if (declaration) {
      const d = declaration as Record<string, unknown>;
      setFormData({
        eori: (d.eori as string) || "",
        declarationType: "H1",
        route: (d.route as string) || "Route 1",
        dispatchCountry: (d.dispatchCountry as string) || "",
        transportMode: (d.transportMode as string) || "",
        transportId: (d.transportId as string) || "",
        transportIdType: (d.transportIdType as string) || "",
        destinationCountry: (d.destinationCountry as string) || "",
        importerEori: (d.importerEori as string) || "",
        invoiceCurrency: (d.invoiceCurrency as string) || "",
        invoiceTotal: d.invoiceTotal != null ? String(d.invoiceTotal) : "",
        incoterms: (d.incoterms as string) || "",
        incotermLocation: (d.incotermLocation as string) || "",
        goodsLocationKind: inferGoodsLocationKind({ goodsLocationKind: d.goodsLocationKind }) || "",
        locationId: (d.locationId as string) || "",
        presentationOffice: (d.presentationOffice as string) || "",
      });
    }
  }, [declaration]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const invoiceTotalParsed = formData.invoiceTotal.trim() === ""
        ? null
        : Number(formData.invoiceTotal);
      await updateDeclaration({
        id,
        eori: formData.eori.trim(),
        declarationType: formData.declarationType,
        route: formData.route,
        dispatchCountry: formData.dispatchCountry,
        transportMode: formData.transportMode,
        transportId: formData.transportId.trim(),
        transportIdType: formData.transportIdType,
        destinationCountry: formData.destinationCountry,
        importerEori: formData.importerEori.trim(),
        invoiceCurrency: formData.invoiceCurrency.trim().toUpperCase(),
        invoiceTotal: invoiceTotalParsed === null || Number.isFinite(invoiceTotalParsed) ? invoiceTotalParsed : null,
        incoterms: formData.incoterms.trim().toUpperCase(),
        incotermLocation: formData.incotermLocation.trim(),
        goodsLocationKind: formData.goodsLocationKind || undefined,
        locationId: formData.locationId.trim(),
        presentationOffice: formData.presentationOffice.trim(),
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
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-gray-900">Core Declaration Details</h2>
        <p className="mt-1 text-xs text-gray-500">
          Enter the core details for this CDS import declaration.
        </p>
      </div>

      {/* Live completeness panel — derived from rule engine. */}
      {completeness && completeness.missing.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 text-xs font-semibold text-amber-900">
            {completeness.missing.length} blocking issue{completeness.missing.length === 1 ? "" : "s"} from rule engine
          </div>
          <ul className="space-y-1 text-[11px] text-amber-900/90">
            {completeness.missing.map((m, i) => (
              <li key={`${m.ruleId}-${i}`} className="flex gap-2">
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px]">{m.field}</code>
                <span>{m.reason}</span>
              </li>
            ))}
          </ul>
          <DeclarationModePromote
            declarationId={id}
            declarationMode={(declaration as { mode?: string }).mode}
            missing={completeness.missing}
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="p-6 space-y-6">

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* EORI Number — DE 3/18 declarant. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Declarant EORI (DE 3/18)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.eori}
                onChange={(e) => setFormData({ ...formData, eori: e.target.value })}
                placeholder="e.g. GB123456789000"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Must match your HMRC Developer Hub credentials.
              </p>
            </div>

            {/* Importer EORI — DE 3/16. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Importer EORI (DE 3/16)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.importerEori}
                onChange={(e) => setFormData({ ...formData, importerEori: e.target.value })}
                placeholder="e.g. GB123456789000"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                The UK importer&apos;s EORI. Same as declarant when self-representing.
              </p>
            </div>

            {/* Declaration Category */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Declaration Category
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.declarationType} onValueChange={(v) => setFormData({ ...formData, declarationType: v })}>
                <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="H1">H1 (Release for Free Circulation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Routing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Customs Routing
              </label>
              <Select value={formData.route} onValueChange={(v) => setFormData({ ...formData, route: v })}>
                <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="Route 1">Route 1 (Documentary Check)</SelectItem>
                  <SelectItem value="Route 2">Route 2 (Physical Exam)</SelectItem>
                  <SelectItem value="Route 6">Route 6 (Direct Clearance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch Country — DE 5/14. A-mandatory per Appendix 21A.
                Native <select> instead of shadcn Select so HTML `required`
                actually fires at form-submit. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Dispatch Country (DE 5/14)
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.dispatchCountry} onValueChange={(v) => setFormData({ ...formData, dispatchCountry: v })}>
                <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue placeholder="Country goods shipped FROM" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Country goods were shipped FROM — never GB for a third-country import.
              </p>
            </div>

            {/* Destination Country — DE 5/8. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Destination Country (DE 5/8)
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.destinationCountry} onValueChange={(v) => setFormData({ ...formData, destinationCountry: v })}>
                <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue placeholder="Country goods shipped TO" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DE 5/23 — PORT = Name+ID only; ADDRESS = separate mode (not mixed). */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Goods location method (DE 5/23)
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.goodsLocationKind} onValueChange={(v) => setFormData({ ...formData, goodsLocationKind: v as GoodsLocationKind | "" })}>
                <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue placeholder="Select how the location is identified" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {GOODS_LOCATION_KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.goodsLocationKind === "port" && (
                <p className="text-[10px] text-gray-500">
                  Port mode splits the Appendix 16C code into XML: chars 1–2 → Address.CountryCode, char 3 → TypeCode, char 4 → Address.TypeCode, remainder → Name (see spec/de-5-23-goods-location.md).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Goods location code (DE 5/23)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                placeholder={
                  formData.goodsLocationKind === "port"
                    ? "e.g. GBAUFXTFXTFXT (Felixstowe)"
                    : "Appendix 16 code"
                }
                disabled={!formData.goodsLocationKind}
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50 disabled:bg-gray-50"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                {formData.goodsLocationKind === "port"
                  ? `Appendix 16C code (e.g. GBAUFXTFXTFXT for Felixstowe). Source: spec/hmrc-mirror/appendix-16c-maritime.psv.`
                  : "Select Port or Address first."}
              </p>
            </div>

            {/* Presentation Office — DE 5/26. Conditional per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Customs Office of Presentation (DE 5/26)
              </label>
              <input
                type="text"
                value={formData.presentationOffice}
                onChange={(e) => setFormData({ ...formData, presentationOffice: e.target.value })}
                placeholder="e.g. GBLON004 (only if presented elsewhere than 5/23)"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Conditional — required only when goods aren&apos;t at the goods location.
              </p>
            </div>

            {/* Invoice currency — DE 4/11 currency. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Invoice Currency (DE 4/11)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceCurrency}
                onChange={(e) => setFormData({ ...formData, invoiceCurrency: e.target.value.toUpperCase() })}
                placeholder="ISO 4217 code, e.g. GBP"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
            </div>

            {/* Invoice total — DE 4/11. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Invoice Total (DE 4/11)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.invoiceTotal}
                onChange={(e) => setFormData({ ...formData, invoiceTotal: e.target.value })}
                placeholder="If empty, mapper sums from items"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Optional override — leave blank to derive from goods item values.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Incoterms (DE 4/1)
              </label>
              <input
                type="text"
                value={formData.incoterms}
                onChange={(e) => setFormData({ ...formData, incoterms: e.target.value.toUpperCase() })}
                placeholder="e.g. CIF"
                className="w-full rounded-md border border-gray-200 p-2.5 font-mono text-sm outline-none transition-colors focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Incoterm location (DE 4/1)
              </label>
              <input
                type="text"
                value={formData.incotermLocation}
                onChange={(e) => setFormData({ ...formData, incotermLocation: e.target.value })}
                placeholder="e.g. Felixstowe or GBFXT"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Required with CIF for method-1 valuation. Mapper sends GB + place (e.g. Felixstowe → GBFELIXSTOWE) per Group 4.
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
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Transport Mode (DE 7/4)
                  <span className="text-red-500">*</span>
                </label>
                <Select value={formData.transportMode} onValueChange={(v) => setFormData({ ...formData, transportMode: v })}>
                  <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent position="popper">
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
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Identification Type (DE 7/9)
                  <span className="text-red-500">*</span>
                </label>
                <Select value={formData.transportIdType} onValueChange={(v) => setFormData({ ...formData, transportIdType: v })}>
                  <SelectTrigger className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                    <SelectValue placeholder="Select identifier type" />
                  </SelectTrigger>
                  <SelectContent position="popper">
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
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Identification (DE 7/9)
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.transportId}
                  onChange={(e) => setFormData({ ...formData, transportId: e.target.value })}
                  placeholder="e.g. IMO9395044, vessel name, vehicle reg"
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
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
            type="submit"
            formNoValidate
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Core Details
          </button>
        </div>
      </div>
    </form>
  );
}
