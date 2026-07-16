"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { Plus, Search, Loader2, Pencil, Archive, ArchiveRestore } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function ClientsPage() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;

  const clients = useQuery(api.clients.list, authReady ? { includeArchived: true } : "skip");
  const createClient = useMutation(api.clients.create);
  const updateClient = useMutation(api.clients.update);
  const setStatus = useMutation(api.clients.setStatus);

  const isLoading = authReady && clients === undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<Id<"clients"> | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const setField = (key: keyof ClientForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (client: NonNullable<typeof clients>[number]) => {
    setEditingId(client._id);
    setForm({
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
    });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (form.name.trim().length < 2) {
      setError("Client name is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
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
      };
      if (editingId) {
        await updateClient({ clientId: editingId, ...payload });
      } else {
        await createClient(payload);
      }
      setShowModal(false);
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

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="relative max-w-md">
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

        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">EORI</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Country</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase text-right w-[110px]">Action</th>
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
                  <td colSpan={5} className="px-6 py-12 text-center text-xs italic text-slate-500">
                    {searchQuery
                      ? "No clients match your search."
                      : "No clients yet. Add the traders you file declarations for."}
                  </td>
                </tr>
              ) : (
                filtered.map((client) => (
                  <tr
                    key={client._id}
                    className={cn(
                      "group transition-colors hover:bg-slate-50",
                      client.status === "archived" && "opacity-50",
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
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(client)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(client)}
                          disabled={busyId === client._id}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Client" : "New Client"}</DialogTitle>
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
                <Select value={form.country} onValueChange={(v) => setField("country", v)}>
                  <SelectTrigger id="country" className="h-9 w-full rounded-md border-slate-200 bg-slate-50 text-xs text-slate-700">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[260px]">
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code} className="text-xs">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              onClick={handleSave}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-black px-4 text-xs font-medium text-white transition-opacity hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Save changes" : "Create client"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
