"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { Plus, Search, Loader2, Archive, ArchiveRestore, Users, ArrowRight } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries } from "@/lib/data/countries";
import { cn } from "@/lib/utils";

interface ClientForm {
  name: string;
  eori: string;
  addressLine: string;
  city: string;
  postcode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
}

const EMPTY_FORM: ClientForm = {
  name: "",
  eori: "",
  addressLine: "",
  city: "",
  postcode: "",
  country: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
};

const FIELD_LABEL = "mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase";
const FIELD_INPUT =
  "h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 transition-colors focus:border-slate-400 focus:outline-none";

const FORM_LABEL = "text-[11px] font-medium text-slate-600";
const FORM_INPUT =
  "mt-1 h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-slate-400";
const FORM_TEXTAREA =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:border-slate-400";

function CountrySelect({
  id,
  value,
  onChange,
  triggerClassName,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  triggerClassName?: string;
}) {
  return (
    <Select
      value={value || "__none__"}
      onValueChange={(next) => onChange(next === "__none__" ? "" : next)}
    >
      <SelectTrigger id={id} className={triggerClassName ?? cn(FORM_INPUT, "bg-white")}>
        <SelectValue placeholder="Select country" />
      </SelectTrigger>
      <SelectContent position="popper" className="z-[110] max-h-[300px]">
        <SelectItem value="__none__" className="text-xs">
          Select country
        </SelectItem>
        {countries.map((c) => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function clientToForm(client: NonNullable<ReturnType<typeof useQuery<typeof api.clients.get>>>): ClientForm {
  return {
    name: client.name ?? "",
    eori: client.eori ?? "",
    addressLine: client.addressLine ?? "",
    city: client.city ?? "",
    postcode: client.postcode ?? "",
    country: client.country ?? "",
    contactName: client.contactName ?? "",
    contactEmail: client.contactEmail ?? "",
    contactPhone: client.contactPhone ?? "",
    notes: client.notes ?? "",
  };
}

function statusTone(status: string) {
  if (status === "archived") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-green-200 bg-green-50 text-green-800";
}

function ClientWorkspaceBody({
  clientId,
  client,
  onArchive,
  isArchiving,
}: {
  clientId: Id<"clients">;
  client: ReturnType<typeof useQuery<typeof api.clients.get>>;
  onArchive: () => Promise<void>;
  isArchiving: boolean;
}) {
  const updateClient = useMutation(api.clients.update);
  const [form, setForm] = useState<ClientForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (client) setForm(clientToForm(client));
  }, [client]);

  const setField = (key: keyof ClientForm, value: string) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.name.trim().length < 2) {
      setError("Client name is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await updateClient({
        clientId,
        name: form.name,
        eori: form.eori,
        addressLine: form.addressLine,
        city: form.city,
        postcode: form.postcode,
        country: form.country,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        notes: form.notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-5 sm:px-8">
        <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <SheetTitle className="truncate text-lg font-semibold text-slate-900">
              {client?.name ?? "…"}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-slate-500">
              Trader profile for declarations you file on their behalf
            </SheetDescription>
            {client && (
              <span
                className={cn(
                  "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                  statusTone(client.status),
                )}
              >
                {client.status === "archived" ? "Archived" : "Active"}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void onArchive()}
              disabled={!client || isArchiving}
              className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isArchiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : client?.status === "archived" ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {client?.status === "archived" ? "Restore" : "Archive"}
            </button>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-6 px-6 py-6 sm:px-8">
        {!client || !form ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading client…
          </div>
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-black">Client profile</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Reusable importer details for declarations. Update fields here when the trader&apos;s address, EORI, or
              contact changes. FreightCode does not register EORI on your behalf.
            </p>

            <form onSubmit={(e) => void handleSave(e)} className="mt-5 space-y-6">
              <div>
                <h3 className="text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">Trader</h3>
                <div className="mt-2 space-y-4 rounded-lg border border-slate-200 p-4">
                  <div>
                    <label htmlFor="client-name" className={FORM_LABEL}>
                      Client / Trader name
                    </label>
                    <input
                      id="client-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={FORM_INPUT}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="client-eori" className={FORM_LABEL}>
                        EORI (optional)
                      </label>
                      <input
                        id="client-eori"
                        type="text"
                        value={form.eori}
                        onChange={(e) => setField("eori", e.target.value)}
                        placeholder="e.g. GB123456789000"
                        className={FORM_INPUT}
                      />
                    </div>
                    <div>
                      <label htmlFor="client-country" className={FORM_LABEL}>
                        Country
                      </label>
                      <CountrySelect
                        id="client-country"
                        value={form.country}
                        onChange={(value) => setField("country", value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">Address</h3>
                <div className="mt-2 space-y-4 rounded-lg border border-slate-200 p-4">
                  <div>
                    <label htmlFor="client-address" className={FORM_LABEL}>
                      Address line
                    </label>
                    <input
                      id="client-address"
                      type="text"
                      value={form.addressLine}
                      onChange={(e) => setField("addressLine", e.target.value)}
                      className={FORM_INPUT}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="client-city" className={FORM_LABEL}>
                        City
                      </label>
                      <input
                        id="client-city"
                        type="text"
                        value={form.city}
                        onChange={(e) => setField("city", e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <div>
                      <label htmlFor="client-postcode" className={FORM_LABEL}>
                        Postcode
                      </label>
                      <input
                        id="client-postcode"
                        type="text"
                        value={form.postcode}
                        onChange={(e) => setField("postcode", e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                  Contact &amp; notes
                </h3>
                <div className="mt-2 space-y-4 rounded-lg border border-slate-200 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="client-contact-name" className={FORM_LABEL}>
                        Contact name
                      </label>
                      <input
                        id="client-contact-name"
                        type="text"
                        value={form.contactName}
                        onChange={(e) => setField("contactName", e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                    <div>
                      <label htmlFor="client-contact-phone" className={FORM_LABEL}>
                        Contact phone
                      </label>
                      <input
                        id="client-contact-phone"
                        type="text"
                        value={form.contactPhone}
                        onChange={(e) => setField("contactPhone", e.target.value)}
                        className={FORM_INPUT}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="client-contact-email" className={FORM_LABEL}>
                      Contact email
                    </label>
                    <input
                      id="client-contact-email"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setField("contactEmail", e.target.value)}
                      className={FORM_INPUT}
                    />
                  </div>
                  <div>
                    <label htmlFor="client-notes" className={FORM_LABEL}>
                      Notes
                    </label>
                    <textarea
                      id="client-notes"
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      rows={3}
                      className={FORM_TEXTAREA}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSaving || form.name.trim().length < 2}
                className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const clients = useQuery(api.clients.list, authReady ? { includeArchived: true } : "skip");
  const createClient = useMutation(api.clients.create);
  const setStatus = useMutation(api.clients.setStatus);

  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const selectedClient = useQuery(
    api.clients.get,
    authReady && selectedClientId ? { clientId: selectedClientId } : "skip",
  );

  const isLoading = !authReady || clients === undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  const setField = (key: keyof ClientForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openClient = (id: Id<"clients">) => setSelectedClientId(id);
  const closeClient = () => setSelectedClientId(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (form.name.trim().length < 2) {
      setError("Client name is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const result = await createClient({
        name: form.name,
        eori: form.eori,
        addressLine: form.addressLine,
        city: form.city,
        postcode: form.postcode,
        country: form.country,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        notes: form.notes,
      });
      setShowModal(false);
      openClient(result.clientId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleArchive = async (client: NonNullable<typeof clients>[number]) => {
    setBusyId(client._id);
    try {
      await setStatus({
        clientId: client._id,
        status: client.status === "archived" ? "active" : "archived",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleSheetArchive = async () => {
    if (!selectedClient) return;
    setIsArchiving(true);
    try {
      await setStatus({
        clientId: selectedClient._id,
        status: selectedClient.status === "archived" ? "active" : "archived",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const filtered = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    const rows = clients ?? [];
    if (!term) return rows;
    return rows.filter((c) =>
      [c.name, c.eori, c.country, c.contactName, c.contactEmail]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [clients, searchQuery]);

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">
            The traders you file declarations on behalf of. Reusable importer details and contacts.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex h-9 items-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Client
        </button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, EORI, country, or contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-4 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">EORI</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Country</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Contact</th>
                <th className="w-[110px] px-6 py-3 text-right text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">
                    Loading clients…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center py-6 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <Users className="h-4 w-4 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {searchQuery ? "No matching clients" : "No clients yet"}
                      </h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        {searchQuery
                          ? "No clients match your search. Try using a different term."
                          : "Add the traders you file declarations for."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr
                    key={client._id}
                    onClick={() => openClient(client._id)}
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-slate-50",
                      client.status === "archived" && "opacity-50",
                      selectedClientId === client._id && "bg-slate-50",
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">{client.name}</span>
                        {client.status === "archived" && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            Archived
                          </span>
                        )}
                      </div>
                      {client.city || client.postcode ? (
                        <span className="mt-0.5 block text-[0.625rem] text-slate-400">
                          {[client.addressLine, client.city, client.postcode].filter(Boolean).join(", ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {client.eori || <span className="text-slate-400">No EORI</span>}
                    </td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">{client.country || "—"}</td>
                    <td className="px-6 py-4 text-[0.6875rem] text-slate-600">
                      {client.contactName || client.contactEmail ? (
                        <div className="flex flex-col">
                          {client.contactName && <span>{client.contactName}</span>}
                          {client.contactEmail && (
                            <span className="text-slate-400">{client.contactEmail}</span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleToggleArchive(client);
                          }}
                          disabled={busyId === client._id}
                          className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                          title={client.status === "archived" ? "Restore" : "Archive"}
                        >
                          {busyId === client._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : client.status === "archived" ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </button>
                        <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={!!selectedClientId} onOpenChange={(open) => !open && closeClient()}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-none"
          style={{ width: "calc(100vw - 15rem)", maxWidth: "calc(100vw - 15rem)" }}
        >
          {selectedClientId && (
            <ClientWorkspaceBody
              clientId={selectedClientId}
              client={selectedClient}
              onArchive={handleSheetArchive}
              isArchiving={isArchiving}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        {showModal ? (
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>New Client</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2 pr-1">
              <div>
                <label htmlFor="name" className={FIELD_LABEL}>
                  Client / Trader name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="e.g. Acme Imports Ltd"
                  className={FIELD_INPUT}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="eori" className={FIELD_LABEL}>
                    EORI (optional)
                  </label>
                  <input
                    id="eori"
                    value={form.eori}
                    onChange={(e) => setField("eori", e.target.value)}
                    placeholder="e.g. GB123456789000"
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="country" className={FIELD_LABEL}>
                    Country
                  </label>
                  <CountrySelect
                    id="country"
                    value={form.country}
                    onChange={(value) => setField("country", value)}
                    triggerClassName={FIELD_INPUT}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="addressLine" className={FIELD_LABEL}>
                  Address line
                </label>
                <input
                  id="addressLine"
                  value={form.addressLine}
                  onChange={(e) => setField("addressLine", e.target.value)}
                  placeholder="Street and number"
                  className={FIELD_INPUT}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="city" className={FIELD_LABEL}>
                    City
                  </label>
                  <input
                    id="city"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="postcode" className={FIELD_LABEL}>
                    Postcode
                  </label>
                  <input
                    id="postcode"
                    value={form.postcode}
                    onChange={(e) => setField("postcode", e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="contactName" className={FIELD_LABEL}>
                    Contact name
                  </label>
                  <input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => setField("contactName", e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label htmlFor="contactPhone" className={FIELD_LABEL}>
                    Contact phone
                  </label>
                  <input
                    id="contactPhone"
                    value={form.contactPhone}
                    onChange={(e) => setField("contactPhone", e.target.value)}
                    className={FIELD_INPUT}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contactEmail" className={FIELD_LABEL}>
                  Contact email
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setField("contactEmail", e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>

              <div>
                <label htmlFor="notes" className={FIELD_LABEL}>
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  rows={2}
                  className={cn(FIELD_INPUT, "h-auto py-2")}
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <button
                disabled={isSaving || form.name.trim().length < 2}
                onClick={() => void handleCreate()}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Create client
              </button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
