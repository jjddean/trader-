"use client";

import React, { useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Info } from "lucide-react";
import { countries } from "@/lib/data/countries";
import {
  inferGoodsLocationKind,
  KNOWN_APPENDIX_16C_CODES,
  type GoodsLocationKind,
} from "@/lib/goods-location";
import { DeclarationModePromote } from "@/components/declaration-mode-promote";
import {
  DeclarationClientPicker,
  DeclarationRepresentationFields,
} from "@/components/declaration-representation-panel";
import {
  ConvexSessionMissing,
  DeclarationLoadingSpinner,
  isConvexSessionMissing,
} from "@/components/declaration-session-states";
import {
  PAYMENT_METHOD_OPTIONS,
  requiresDefermentAccount,
  validatePaymentFields,
} from "@/lib/payment-method";

const TRANSPORT_MODE_OPTIONS = [
  { value: "1", label: "1 — Sea" },
  { value: "2", label: "2 — Rail" },
  { value: "3", label: "3 — Road" },
  { value: "4", label: "4 — Air" },
  { value: "5", label: "5 — Postal" },
  { value: "7", label: "7 — Fixed transport installations" },
  { value: "8", label: "8 — Inland waterway" },
  { value: "9", label: "9 — Mode unknown" },
] as const;

const TRANSPORT_ID_TYPE_OPTIONS = [
  { value: "10", label: "10 — IMO ship identification number" },
  { value: "11", label: "11 — Name of seagoing vessel" },
  { value: "20", label: "20 — Wagon number" },
  { value: "30", label: "30 — Vehicle registration number" },
  { value: "40", label: "40 — IATA flight number" },
  { value: "41", label: "41 — Registration of aircraft" },
] as const;

function normalizeTransportIdType(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const code = raw.match(/^(\d{2})/)?.[1];
  return code ?? raw;
}

function normalizeTransportMode(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const code = raw.match(/^(\d)/)?.[1];
  return code ?? raw;
}

const selectFieldClassName =
  "w-full rounded-md border border-slate-200 bg-white p-2.5 text-sm outline-none transition-colors focus:border-blue-500";

// DE 5/23 — the Appendix 16C maritime list, sorted by port name for the picker.
// Selecting an entry is what sets goodsLocationKind, so the two fields can no
// longer drift apart (the old free-text code + separate method dropdown could).
const PORT_LOCATION_OPTIONS = Object.entries(KNOWN_APPENDIX_16C_CODES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Hydrate once per declaration id — getLane re-reuns on status/badge updates.
  const hydratedForIdRef = useRef<string | null>(null);
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
    exporterName: "",
    exporterCity: "",
    exporterLine: "",
    exporterPostcode: "",
    transactionNatureCode: "",
    paymentMethodCode: "",
    defermentAccountNumber: "",
  });

  React.useEffect(() => {
    hydratedForIdRef.current = null;
  }, [id]);

  React.useEffect(() => {
    if (!declaration || !id) return;
    if (hydratedForIdRef.current === id) return;
    hydratedForIdRef.current = id;
    const d = declaration as Record<string, unknown>;
    setFormData({
      eori: (d.eori as string) || "",
      declarationType: "H1",
      route: (d.route as string) || "Route 1",
      dispatchCountry: (d.dispatchCountry as string) || "",
      transportMode: normalizeTransportMode(d.transportMode),
      transportId: (d.transportId as string) || "",
      transportIdType: normalizeTransportIdType(d.transportIdType),
      destinationCountry: (d.destinationCountry as string) || "",
      importerEori: (d.importerEori as string) || "",
      invoiceCurrency: (d.invoiceCurrency as string) || "",
      invoiceTotal: d.invoiceTotal != null ? String(d.invoiceTotal) : "",
      incoterms: (d.incoterms as string) || "",
      incotermLocation: (d.incotermLocation as string) || "",
      goodsLocationKind:
        inferGoodsLocationKind({
          goodsLocationKind: d.goodsLocationKind,
          locationId: d.locationId,
        }) || "",
      locationId: (d.locationId as string) || "",
      presentationOffice: (d.presentationOffice as string) || "",
      exporterName: (d.exporterName as string) || "",
      exporterCity: (d.exporterCity as string) || "",
      exporterLine: (d.exporterLine as string) || "",
      exporterPostcode: (d.exporterPostcode as string) || "",
      transactionNatureCode: (d.transactionNatureCode as string) || "",
      paymentMethodCode: (d.paymentMethodCode as string) || "",
      defermentAccountNumber: (d.defermentAccountNumber as string) || "",
    });
  }, [declaration, id]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const validationMessages: string[] = [];
      if (!formData.transportIdType.trim()) {
        validationMessages.push("Identification Type (DE 7/9) is required.");
      }
      if (!formData.transportMode.trim()) {
        validationMessages.push("Transport Mode (DE 7/4) is required.");
      }
      const dispatch = formData.dispatchCountry.trim().toUpperCase();
      if (dispatch && dispatch !== "GB" && dispatch !== "XI") {
        if (!formData.exporterName.trim()) {
          validationMessages.push("Exporter name (DE 3/1) is required for overseas dispatch.");
        }
        if (!formData.exporterCity.trim() || !formData.exporterLine.trim() || !formData.exporterPostcode.trim()) {
          validationMessages.push("Exporter city, address line, and postcode (DE 3/1) are required for overseas dispatch.");
        }
      }
      if (!formData.transactionNatureCode.trim()) {
        validationMessages.push("Nature of transaction (DE 8/5) is required.");
      }
      const paymentError = validatePaymentFields(
        formData.paymentMethodCode,
        requiresDefermentAccount(formData.paymentMethodCode)
          ? formData.defermentAccountNumber
          : "",
      );
      if (paymentError) {
        setSaveError(paymentError);
        return;
      }
      const invoiceTotalParsed = formData.invoiceTotal.trim() === ""
        ? null
        : Number(formData.invoiceTotal);
      await updateDeclaration({
        id,
        eori: formData.eori.trim(),
        declarationType: formData.declarationType,
        route: formData.route,
        dispatchCountry: formData.dispatchCountry,
        transportMode: normalizeTransportMode(formData.transportMode),
        transportId: formData.transportId.trim(),
        transportIdType: normalizeTransportIdType(formData.transportIdType),
        destinationCountry: formData.destinationCountry,
        importerEori: formData.importerEori.trim(),
        invoiceCurrency: formData.invoiceCurrency.trim().toUpperCase(),
        invoiceTotal: invoiceTotalParsed === null || Number.isFinite(invoiceTotalParsed) ? invoiceTotalParsed : null,
        incoterms: formData.incoterms.trim().toUpperCase(),
        incotermLocation: formData.incotermLocation.trim(),
        // Fall back to inferring from the code itself. Sending undefined makes
        // the mutation skip the field entirely, so an unset kind could never be
        // persisted even when the code alone identified the location.
        goodsLocationKind:
          formData.goodsLocationKind ||
          inferGoodsLocationKind({ locationId: formData.locationId }) ||
          undefined,
        locationId: formData.locationId.trim(),
        presentationOffice: formData.presentationOffice.trim(),
        exporterName: formData.exporterName.trim(),
        exporterCity: formData.exporterCity.trim(),
        exporterLine: formData.exporterLine.trim(),
        exporterPostcode: formData.exporterPostcode.trim(),
        transactionNatureCode: formData.transactionNatureCode.trim(),
        paymentMethodCode: formData.paymentMethodCode.trim().toUpperCase() || undefined,
        defermentAccountNumber: requiresDefermentAccount(formData.paymentMethodCode)
          ? formData.defermentAccountNumber.replace(/\D/g, "")
          : undefined,
      });
      hydratedForIdRef.current = null;
      if (validationMessages.length > 0) {
        setSaveError(`Saved draft. Still blocking: ${validationMessages[0]}`);
      } else {
        setSaveSuccess(true);
      }
    } catch (e) {
      console.error("Failed to save core schema", e);
      setSaveError(e instanceof Error ? e.message : "Failed to save core details");
    } finally {
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return <DeclarationLoadingSpinner />;
  }

  if (isConvexSessionMissing(isLoaded, Boolean(isSignedIn), isConvexAuthLoading, isAuthenticated)) {
    return <ConvexSessionMissing />;
  }

  if (isSignedIn && isAuthenticated && declaration === undefined) {
    return <DeclarationLoadingSpinner />;
  }

  if (!declaration) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-sm text-slate-500">Declaration not found.</p>
      </div>
    );
  }

  const locationIdUpper = formData.locationId.trim().toUpperCase();
  const locationIdIsKnown = Boolean(locationIdUpper && KNOWN_APPENDIX_16C_CODES[locationIdUpper]);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-slate-900">Core Declaration Details</h2>
        <p className="mt-1 text-xs text-slate-500">
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

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-6 space-y-6">

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* EORI Number — DE 3/18 declarant. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Declarant EORI (DE 3/18)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.eori}
                onChange={(e) => setFormData({ ...formData, eori: e.target.value })}
                placeholder="e.g. GB123456789000"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Must match your HMRC Developer Hub credentials.
              </p>
            </div>

            {/* Importer EORI — DE 3/16. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Importer EORI (DE 3/16)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.importerEori}
                onChange={(e) => setFormData({ ...formData, importerEori: e.target.value })}
                placeholder="e.g. GB123456789000"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                The UK importer&apos;s EORI. Same as declarant when self-representing.
              </p>
            </div>

            {/* Declaration Category */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Declaration Category
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.declarationType} onValueChange={(v) => setFormData({ ...formData, declarationType: v })}>
                <SelectTrigger className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="H1">H1 (Release for Free Circulation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Routing */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customs Routing
              </label>
              <Select value={formData.route} onValueChange={(v) => setFormData({ ...formData, route: v })}>
                <SelectTrigger className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="Route 1">Route 1 (Documentary Check)</SelectItem>
                  <SelectItem value="Route 2">Route 2 (Physical Exam)</SelectItem>
                  <SelectItem value="Route 6">Route 6 (Direct Clearance)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dispatch Country — DE 5/14. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Dispatch Country (DE 5/14)
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.dispatchCountry} onValueChange={(v) => setFormData({ ...formData, dispatchCountry: v })}>
                <SelectTrigger className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue placeholder="Country goods shipped FROM" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Country goods were shipped FROM — never GB for a third-country import.
              </p>
            </div>

            <DeclarationClientPicker declarationId={id} />

            {formData.dispatchCountry && formData.dispatchCountry !== "GB" && formData.dispatchCountry !== "XI" && (
              <div className="md:col-span-2 space-y-3 rounded-md border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Overseas exporter (DE 3/1) — required when dispatch ≠ GB/XI
                </p>
                <p className="text-[11px] text-slate-600">
                  Use the foreign seller on the commercial invoice — legal name and registered address in the dispatch country (not your UK importer details).
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Exporter name</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 p-2.5 text-sm"
                      value={formData.exporterName}
                      onChange={(e) => setFormData({ ...formData, exporterName: e.target.value })}
                      placeholder="e.g. Acme Export GmbH"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-slate-600">Address line</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 p-2.5 text-sm"
                      value={formData.exporterLine}
                      onChange={(e) => setFormData({ ...formData, exporterLine: e.target.value })}
                      placeholder="e.g. 1 Hafenstrasse"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">City</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 p-2.5 text-sm"
                      value={formData.exporterCity}
                      onChange={(e) => setFormData({ ...formData, exporterCity: e.target.value })}
                      placeholder="e.g. Hamburg"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Postcode</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-200 p-2.5 text-sm"
                      value={formData.exporterPostcode}
                      onChange={(e) => setFormData({ ...formData, exporterPostcode: e.target.value })}
                      placeholder="e.g. 20095"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Destination Country — DE 5/8. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Destination Country (DE 5/8)
                <span className="text-red-500">*</span>
              </label>
              <Select value={formData.destinationCountry} onValueChange={(v) => setFormData({ ...formData, destinationCountry: v })}>
                <SelectTrigger className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                  <SelectValue placeholder="Country goods shipped TO" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DE 5/23 — one picker sets both the code and the kind, so the
                method can't be left unset while a code is present. Port mode
                splits the Appendix 16C code into XML: chars 1–2 →
                Address.CountryCode, char 3 → TypeCode, char 4 →
                Address.TypeCode, remainder → Name (see
                docs/hmrc/ACTIVE/tdr/mapping/de-5-23-goods-location.md). */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Location of goods (DE 5/23)
                <span className="text-red-500">*</span>
              </label>
              <Select
                value={locationIdIsKnown ? locationIdUpper : ""}
                onValueChange={(code) =>
                  setFormData({ ...formData, locationId: code, goodsLocationKind: "port" })
                }
              >
                <SelectTrigger className={selectFieldClassName}>
                  <SelectValue placeholder="Select maritime port or wharf (Appendix 16C)" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  {PORT_LOCATION_OPTIONS.map(({ code, name }) => (
                    <SelectItem key={code} value={code} className="text-xs">
                      {name} — {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locationIdUpper && !locationIdIsKnown && (
                <div className="space-y-1.5 rounded-md border border-amber-200 bg-amber-50/80 p-3">
                  <p className="text-[11px] text-amber-900">
                    This declaration has code <code className="font-mono">{formData.locationId.trim()}</code>, which
                    is not in Appendix 16C. Pick a port above or replace it below, then save.
                  </p>
                  <input
                    type="text"
                    value={formData.locationId}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase();
                      setFormData({
                        ...formData,
                        locationId: next,
                        goodsLocationKind:
                          inferGoodsLocationKind({ locationId: next, goodsLocationKind: "port" }) || "",
                      });
                    }}
                    className="w-full rounded-md border border-amber-200 bg-white p-2 text-sm font-mono outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Official HMRC maritime location codes — not a fixed default port.
              </p>
            </div>

            {/* Presentation Office — DE 5/26. Conditional per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Customs Office of Presentation (DE 5/26)
              </label>
              <input
                type="text"
                value={formData.presentationOffice}
                onChange={(e) => setFormData({ ...formData, presentationOffice: e.target.value })}
                placeholder="e.g. GBLON004 (only if presented elsewhere than 5/23)"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Conditional — required only when goods aren&apos;t at the goods location.
              </p>
            </div>

            {/* Invoice currency — DE 4/11 currency. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Invoice Currency (DE 4/11)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceCurrency}
                onChange={(e) => setFormData({ ...formData, invoiceCurrency: e.target.value.toUpperCase() })}
                placeholder="ISO 4217 code, e.g. GBP"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm font-mono outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
            </div>

            {/* Invoice total — DE 4/11. A-mandatory per Appendix 21A. */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Invoice Total (DE 4/11)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.invoiceTotal}
                onChange={(e) => setFormData({ ...formData, invoiceTotal: e.target.value })}
                placeholder="If empty, mapper sums from items"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Optional override — leave blank to derive from goods item values.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Incoterms (DE 4/1)
              </label>
              <input
                type="text"
                value={formData.incoterms}
                onChange={(e) => setFormData({ ...formData, incoterms: e.target.value.toUpperCase() })}
                placeholder="e.g. CIF"
                className="w-full rounded-md border border-slate-200 p-2.5 font-mono text-sm outline-none transition-colors focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Incoterm location (DE 4/1)
              </label>
              <input
                type="text"
                value={formData.incotermLocation}
                onChange={(e) => setFormData({ ...formData, incotermLocation: e.target.value })}
                placeholder="e.g. Felixstowe or GBFXT"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Required with CIF for method-1 valuation. Mapper sends GB + place (e.g. Felixstowe → GBFELIXSTOWE) per Group 4.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                Nature of Transaction (DE 8/5)
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.transactionNatureCode}
                onChange={(e) => setFormData({ ...formData, transactionNatureCode: e.target.value })}
                placeholder="e.g. 11"
                className="w-full rounded-md border border-slate-200 p-2.5 font-mono text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
              />
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                WCOID 103 — GoodsShipment/TransactionNatureCode. Trade Test passing baseline uses 11.
              </p>
            </div>

          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-medium text-slate-900">Duty payment</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              DE 4/8 method of payment and DE 2/6 deferment account. Required when paying via deferment (MOP E or R).
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Method of payment (DE 4/8)
                </label>
                <Select
                  value={formData.paymentMethodCode || "__none__"}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      paymentMethodCode: v === "__none__" ? "" : v,
                      defermentAccountNumber:
                        v === "E" || v === "R" ? formData.defermentAccountNumber : "",
                    })
                  }
                >
                  <SelectTrigger className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {PAYMENT_METHOD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value || "__none__"} value={opt.value || "__none__"}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {requiresDefermentAccount(formData.paymentMethodCode) && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                    Deferment account (DE 2/6)
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{7}"
                    maxLength={7}
                    required
                    value={formData.defermentAccountNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defermentAccountNumber: e.target.value.replace(/\D/g, "").slice(0, 7),
                      })
                    }
                    placeholder="7-digit DAN"
                    className="w-full rounded-md border border-slate-200 p-2.5 font-mono text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                  />
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    HMRC deferment account number (1DAN). Stored on your declaration only — not logged in audit output.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DeclarationRepresentationFields declarationId={id} />

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-medium text-slate-900">Transport Identity</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              DE 7/4 (mode), DE 7/7 / 7/9 (border / arrival means). CDS rejects mismatched or stale values — use the actual vessel/IMO/wagon/vehicle/flight identifier for this consignment.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                  Transport Mode (DE 7/4)
                  <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.transportMode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, transportMode: e.target.value }))}
                  className={selectFieldClassName}
                >
                  <option value="" disabled>
                    Select mode
                  </option>
                  {TRANSPORT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                  Identification Type (DE 7/9)
                  <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.transportIdType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, transportIdType: e.target.value }))}
                  className={selectFieldClassName}
                >
                  <option value="" disabled>
                    Select identifier type
                  </option>
                  {TRANSPORT_ID_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex justify-between">
                  Identification (DE 7/9)
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.transportId}
                  onChange={(e) => setFormData({ ...formData, transportId: e.target.value })}
                  placeholder="e.g. IMO9395044, vessel name, vehicle reg"
                  className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500 invalid:border-red-300 invalid:bg-red-50"
                />
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Real identifier for this consignment. Don&apos;t carry over a value from a previous declaration.
                </p>
              </div>
            </div>
          </div>

        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 p-4 px-6 flex items-center justify-end gap-3">
          {saveError && (
            <p className="mr-auto text-xs text-red-600">{saveError}</p>
          )}
          {saveSuccess && !saveError && (
            <p className="mr-auto text-xs text-green-700">Core details saved.</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Core Details
          </button>
        </div>
      </div>
    </form>
  );
}
