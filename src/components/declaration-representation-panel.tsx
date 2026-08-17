"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompactCheckbox } from "@/components/ui/compact-checkbox";
import { countries } from "@/lib/data/countries";
import { userMessageFromError } from "@/lib/convex-errors";

const selectTriggerClassName =
  "w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none transition-colors focus:border-blue-500";

type RepresentationType = "self" | "direct" | "indirect";

interface RepresentationForm {
  representationType: RepresentationType;
  representativeEori: string;
  representativeName: string;
  representativeAddressLine: string;
  representativeCity: string;
  representativePostcode: string;
  representativeCountry: string;
  authorityVerified: boolean;
  authorityValidFrom: string;
  authorityValidTo: string;
}

const EMPTY_REP: RepresentationForm = {
  representationType: "self",
  representativeEori: "",
  representativeName: "",
  representativeAddressLine: "",
  representativeCity: "",
  representativePostcode: "",
  representativeCountry: "",
  authorityVerified: false,
  authorityValidFrom: "",
  authorityValidTo: "",
};

function dateInputValue(ms: number | undefined | null): string {
  if (!ms || !Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDateInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function DeclarationClientPicker({
  declarationId,
}: {
  declarationId: Id<"declarations">;
}) {
  const declaration = useQuery(api.declarations.getLane, { id: declarationId });
  const clients = useQuery(api.clients.list, { includeArchived: false });
  const setClient = useMutation(api.clients.setClient);
  const [clientBusy, setClientBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const linkedClientId = declaration?.clientId ? String(declaration.clientId) : undefined;

  async function handleClientChange(value: string) {
    setClientBusy(true);
    setClientError(null);
    try {
      await setClient({
        declarationId,
        clientId: value === "__none__" ? null : value,
      });
    } catch (err) {
      setClientError(userMessageFromError(err, "Failed to link client"));
    } finally {
      setClientBusy(false);
    }
  }

  if (clients === undefined || declaration === undefined) {
    return (
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Client (filed on behalf of)
        </label>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Client (filed on behalf of)
      </label>
      <Select
        value={linkedClientId ?? "__none__"}
        onValueChange={(v) => void handleClientChange(v)}
        disabled={clientBusy}
      >
        <SelectTrigger className={selectTriggerClassName}>
          <SelectValue placeholder="No client linked" />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="__none__">No client linked</SelectItem>
          {(clients ?? []).map((client) => (
            <SelectItem key={client._id} value={client._id}>
              {client.name}
              {client.eori ? ` · ${client.eori}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {clientError && <p className="text-xs text-red-600">{clientError}</p>}
      <p className="text-[10px] text-slate-400 flex items-center gap-1">
        <Info className="h-3 w-3 shrink-0" />
        Association only — manage in{" "}
        <Link href="/dashboard/clients" className="text-blue-600 hover:underline">
          Clients
        </Link>
        .
      </p>
    </div>
  );
}

export function DeclarationRepresentationFields({
  declarationId,
}: {
  declarationId: Id<"declarations">;
}) {
  const representationStatus = useQuery(api.representation.getStatus, { declarationId });
  const setRepresentationDetails = useMutation(api.representation.setRepresentationDetails);

  const [repForm, setRepForm] = useState<RepresentationForm>(EMPTY_REP);
  const [repHydrated, setRepHydrated] = useState(false);
  const [repSaving, setRepSaving] = useState(false);
  const [repError, setRepError] = useState<string | null>(null);
  const [repSuccess, setRepSuccess] = useState(false);

  useEffect(() => {
    setRepHydrated(false);
  }, [declarationId]);

  useEffect(() => {
    if (!representationStatus || repHydrated) return;
    const rep = representationStatus.representation;
    setRepForm({
      representationType: (rep.representationType as RepresentationType) || "self",
      representativeEori: rep.representativeEori || "",
      representativeName: rep.representativeName || "",
      representativeAddressLine: rep.representativeAddressLine || "",
      representativeCity: rep.representativeCity || "",
      representativePostcode: rep.representativePostcode || "",
      representativeCountry: rep.representativeCountry || "",
      authorityVerified: rep.authorityVerified ?? false,
      authorityValidFrom: dateInputValue(rep.authorityValidFrom),
      authorityValidTo: dateInputValue(rep.authorityValidTo),
    });
    setRepHydrated(true);
  }, [representationStatus, repHydrated]);

  const showRepFields = repForm.representationType !== "self";
  const showAuthority = repForm.representationType === "indirect";

  async function handleSaveRepresentation() {
    setRepSaving(true);
    setRepError(null);
    setRepSuccess(false);
    try {
      await setRepresentationDetails({
        declarationId,
        representationType: repForm.representationType,
        representativeEori: showRepFields ? repForm.representativeEori.trim() || null : null,
        representativeName: showRepFields ? repForm.representativeName.trim() || null : null,
        representativeAddressLine: showRepFields ? repForm.representativeAddressLine.trim() || null : null,
        representativeCity: showRepFields ? repForm.representativeCity.trim() || null : null,
        representativePostcode: showRepFields ? repForm.representativePostcode.trim() || null : null,
        representativeCountry: showRepFields ? repForm.representativeCountry.trim().toUpperCase() || null : null,
        authorityVerified: showAuthority ? repForm.authorityVerified : false,
        authorityValidFrom: showAuthority ? parseDateInput(repForm.authorityValidFrom) ?? null : null,
        authorityValidTo: showAuthority ? parseDateInput(repForm.authorityValidTo) ?? null : null,
      });
      setRepSuccess(true);
      setRepHydrated(false);
    } catch (err) {
      setRepError(userMessageFromError(err, "Failed to save representation"));
    } finally {
      setRepSaving(false);
    }
  }

  if (representationStatus === undefined) {
    return (
      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading representation…
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 pt-6">
      <h3 className="text-sm font-medium text-slate-900">Customs representation</h3>
      <p className="mt-1 text-[11px] text-slate-500">
        DE 3/19–3/21. Indirect representation requires approval on the Submit tab.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Representation type (DE 3/21)
          </label>
          <Select
            value={repForm.representationType}
            onValueChange={(v) =>
              setRepForm((prev) => ({
                ...prev,
                representationType: v as RepresentationType,
              }))
            }
          >
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="self">Self — declarant is the importer</SelectItem>
              <SelectItem value="direct">Direct — broker acts for importer (DE 3/21 = 2)</SelectItem>
              <SelectItem value="indirect">Indirect — broker is declarant (DE 3/21 = 3)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showRepFields && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Representative EORI (DE 3/19)
              </label>
              <input
                type="text"
                value={repForm.representativeEori}
                onChange={(e) => setRepForm({ ...repForm, representativeEori: e.target.value })}
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm font-mono outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Representative name (DE 3/19)
              </label>
              <input
                type="text"
                value={repForm.representativeName}
                onChange={(e) => setRepForm({ ...repForm, representativeName: e.target.value })}
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Representative address (DE 3/19)
              </label>
              <input
                type="text"
                value={repForm.representativeAddressLine}
                onChange={(e) => setRepForm({ ...repForm, representativeAddressLine: e.target.value })}
                placeholder="Address line"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={repForm.representativeCity}
                onChange={(e) => setRepForm({ ...repForm, representativeCity: e.target.value })}
                placeholder="City"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={repForm.representativePostcode}
                onChange={(e) => setRepForm({ ...repForm, representativePostcode: e.target.value })}
                placeholder="Postcode"
                className="w-full rounded-md border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Select
                value={repForm.representativeCountry || "__none__"}
                onValueChange={(v) =>
                  setRepForm({
                    ...repForm,
                    representativeCountry: v === "__none__" ? "" : v,
                  })
                }
              >
                <SelectTrigger className={selectTriggerClassName}>
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-[300px]">
                  <SelectItem value="__none__">Select country</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {showAuthority && (
          <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
            <p className="text-xs font-medium text-amber-900">Authority documents (indirect)</p>
            <label className="flex items-center gap-2 text-xs text-amber-900">
              <CompactCheckbox
                border="amber"
                checked={repForm.authorityVerified}
                onChange={(e) => setRepForm({ ...repForm, authorityVerified: e.target.checked })}
              />
              Authority documents verified
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-amber-800">
                  Valid from
                </label>
                <input
                  type="date"
                  value={repForm.authorityValidFrom}
                  onChange={(e) => setRepForm({ ...repForm, authorityValidFrom: e.target.value })}
                  className="w-full rounded-md border border-amber-200 bg-white p-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-amber-800">
                  Valid to
                </label>
                <input
                  type="date"
                  value={repForm.authorityValidTo}
                  onChange={(e) => setRepForm({ ...repForm, authorityValidTo: e.target.value })}
                  className="w-full rounded-md border border-amber-200 bg-white p-2 text-sm"
                />
              </div>
            </div>
            {representationStatus?.approvalRequired && (
              <p
                className={cn(
                  "text-[11px]",
                  representationStatus?.approvalCurrent ? "text-green-700" : "text-amber-800",
                )}
              >
                {representationStatus?.approvalCurrent
                  ? `Approved — submit unlocked.`
                  : representationStatus?.reason ??
                    "Internal approval required on Submit tab before HMRC submission."}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {repError && <p className="text-xs text-red-600">{repError}</p>}
        {repSuccess && !repError && <p className="text-xs text-green-700">Representation saved.</p>}
        <button
          type="button"
          disabled={repSaving}
          onClick={() => void handleSaveRepresentation()}
          className="ml-auto flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {repSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save representation
        </button>
      </div>
    </div>
  );
}
