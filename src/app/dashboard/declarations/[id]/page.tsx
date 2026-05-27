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
    locationId: "",
    goodsLocationTypeCode: "",
    goodsLocationQualifier: "",
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
        locationId: (d.locationId as string) || "",
        goodsLocationTypeCode: (d.goodsLocationTypeCode as string) || "",
        goodsLocationQualifier: (d.goodsLocationQualifier as string) || "",
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
        locationId: formData.locationId.trim(),
        goodsLocationTypeCode: formData.goodsLocationTypeCode.trim().toUpperCase(),
        goodsLocationQualifier: formData.goodsLocationQualifier.trim().toUpperCase(),
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

            {/* Dispatch Country — DE 5/14. A-mandatory per Appendix 21A.
                Native <select> instead of shadcn Select so HTML `required`
                actually fires at form-submit. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Dispatch Country (DE 5/14)
                <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.dispatchCountry}
                onChange={(e) => setFormData({ ...formData, dispatchCountry: e.target.value })}
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              >
                <option value="">Country goods shipped FROM</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
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
              <select
                value={formData.destinationCountry}
                onChange={(e) => setFormData({ ...formData, destinationCountry: e.target.value })}
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              >
                <option value="">Country goods shipped TO</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            {/* Goods Location — DE 5/23. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                Goods Location (DE 5/23)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.locationId}
                onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                placeholder="e.g. GBAUFXTFXTGW"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                UN/LOCODE or HMRC location code. No default.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Goods Location Type
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.goodsLocationTypeCode}
                  onChange={(e) => setFormData({ ...formData, goodsLocationTypeCode: e.target.value })}
                  placeholder="e.g. A / B"
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Goods Location Qualifier
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.goodsLocationQualifier}
                  onChange={(e) => setFormData({ ...formData, goodsLocationQualifier: e.target.value })}
                  placeholder="e.g. U / V"
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                />
              </div>
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
                Incoterm Location
              </label>
              <input
                type="text"
                value={formData.incotermLocation}
                onChange={(e) => setFormData({ ...formData, incotermLocation: e.target.value })}
                placeholder="e.g. Felixstowe"
                className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
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
                <select
                  required
                  value={formData.transportMode}
                  onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                >
                  <option value="">Select mode</option>
                  <option value="1">1 — Sea</option>
                  <option value="2">2 — Rail</option>
                  <option value="3">3 — Road</option>
                  <option value="4">4 — Air</option>
                  <option value="5">5 — Postal</option>
                  <option value="7">7 — Fixed transport installations</option>
                  <option value="8">8 — Inland waterway</option>
                  <option value="9">9 — Mode unknown</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex justify-between">
                  Identification Type (DE 7/7)
                  <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.transportIdType}
                  onChange={(e) => setFormData({ ...formData, transportIdType: e.target.value })}
                  className="w-full rounded-md border border-gray-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                >
                  <option value="">Select identifier type</option>
                  <option value="10">10 — IMO ship identification number</option>
                  <option value="11">11 — Name of seagoing vessel</option>
                  <option value="20">20 — Wagon number</option>
                  <option value="30">30 — Vehicle registration number</option>
                  <option value="40">40 — IATA flight number</option>
                  <option value="41">41 — Registration of aircraft</option>
                </select>
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
