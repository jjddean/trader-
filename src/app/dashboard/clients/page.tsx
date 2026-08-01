"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import {
  Plus,
  Search,
  Filter,
  Loader2,
  Archive,
  ArchiveRestore,
  Users,
  ArrowRight,
  Link2,
  Unlink,
  MessageSquare,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPortalCaseLabel, formatPortalFilingLabel } from "@/components/portal/portal-status";
import { PortalMessageThread } from "@/components/portal/portal-message-thread";
import {
  ENTERPRISE_SELECT_CONTENT,
  ENTERPRISE_SELECT_ITEM,
  ENTERPRISE_SELECT_TRIGGER,
} from "@/lib/enterprise-select-styles";
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

const STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All clients" },
] as const;

type StatusFilter = (typeof STATUS_FILTER_OPTIONS)[number]["value"];

function ClientPortalAccessCard({
  clientId,
  client,
}: {
  clientId: Id<"clients">;
  client: NonNullable<ReturnType<typeof useQuery<typeof api.clients.get>>>;
}) {
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);
  const linkedDeclCount = useQuery(
    api.clients.countLinkedDeclarations,
    authReady ? { clientId } : "skip",
  );
  const revokePortalAccess = useMutation(api.clients.revokePortalAccess);
  const [portalEmail, setPortalEmail] = useState(
    () => client.portalEmail ?? client.contactEmail ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPortalAccess = Boolean(client.portalEmail);
  const isArchived = client.status === "archived";

  const handleEnable = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, portalEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        portalEmail?: string;
        emailSent?: boolean;
        emailNote?: string;
      };
      if (!res.ok) {
        throw new Error(body.error || "Failed to enable portal access.");
      }
      setSuccess(`Portal access enabled. Invite sent to ${body.portalEmail}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable portal access.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    setError(null);
    setSuccess(null);
    try {
      await revokePortalAccess({ clientId });
      setSuccess("Portal access revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke portal access.");
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <Link2 className="h-4 w-4 text-slate-400" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-black">Client portal access</h3>
          <p className="text-[11px] text-slate-500">
            Read-only login so this trader can view declarations filed on their behalf
          </p>
        </div>
        {hasPortalAccess ? (
          <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
            Enabled
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-600">
            Off
          </span>
        )}
      </div>
      <div className="space-y-4 p-6">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                Portal email
              </label>
              <p className="text-xs text-black">{client.portalEmail || "—"}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                Clerk binding
              </label>
              <p className="text-xs text-slate-700">
                {client.portalClerkId ? "Signed in at least once" : "Not linked yet"}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="portal-email" className={FORM_LABEL}>
            Invite email
          </label>
          <input
            id="portal-email"
            type="email"
            value={portalEmail}
            onChange={(e) => setPortalEmail(e.target.value)}
            disabled={isArchived}
            placeholder="client@company.com"
            className={FORM_INPUT}
          />
          <p className="mt-1.5 text-[11px] text-slate-500">
            Must match the email they use to sign in with Clerk. Changing the email clears the previous login link.
          </p>
        </div>

        {isArchived && (
          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Restore this client before enabling portal access.
          </div>
        )}

        {!isArchived && linkedDeclCount === 0 && (
          <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            No declarations are linked to this client yet. The portal will be empty until you attach
            declarations via the declaration client picker.
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        )}
        {success && (
          <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {success}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleEnable()}
            disabled={isArchived || isSaving || portalEmail.trim().length < 3}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            {hasPortalAccess ? "Update & resend invite" : "Enable & send invite"}
          </button>
          {hasPortalAccess && (
            <button
              type="button"
              onClick={() => void handleRevoke()}
              disabled={isRevoking}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isRevoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
              Revoke
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type BrokerThreadKey =
  | { kind: "declaration"; id: Id<"declarations"> }
  | { kind: "assessment"; id: Id<"export_assessments"> }
  | null;

function parseBrokerThreadValue(value: string): BrokerThreadKey {
  if (value.startsWith("declaration:")) {
    return { kind: "declaration", id: value.slice("declaration:".length) as Id<"declarations"> };
  }
  if (value.startsWith("assessment:")) {
    return {
      kind: "assessment",
      id: value.slice("assessment:".length) as Id<"export_assessments">,
    };
  }
  return null;
}

function brokerThreadValue(thread: BrokerThreadKey): string {
  if (!thread) return "";
  return thread.kind === "declaration"
    ? `declaration:${thread.id}`
    : `assessment:${thread.id}`;
}

function ClientPortalMessagesCard({ clientId }: { clientId: Id<"clients"> }) {
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const declarations = useQuery(
    api.clients.listLinkedDeclarations,
    authReady ? { clientId } : "skip",
  );
  const assessments = useQuery(
    api.clients.listLinkedAssessments,
    authReady ? { clientId } : "skip",
  );

  const [thread, setThread] = useState<BrokerThreadKey>(null);

  // Default to most recent declaration/case once lists load.
  const defaultThread = useMemo((): BrokerThreadKey => {
    if (declarations && declarations.length > 0) {
      return { kind: "declaration", id: declarations[0]!._id };
    }
    if (assessments && assessments.length > 0) {
      return { kind: "assessment", id: assessments[0]!._id };
    }
    return null;
  }, [declarations, assessments]);

  const activeThread = thread ?? defaultThread;

  const messageArgs = useMemo(() => {
    if (!authReady || !activeThread) return "skip" as const;
    if (activeThread.kind === "declaration") {
      return { clientId, declarationId: activeThread.id };
    }
    return { clientId, assessmentId: activeThread.id };
  }, [authReady, clientId, activeThread]);

  const messages = useQuery(api.clients.listPortalMessages, messageArgs);
  const sendBrokerMessage = useMutation(api.clients.sendBrokerMessage);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !activeThread) return;
    setIsSending(true);
    setError(null);
    try {
      if (activeThread.kind === "declaration") {
        await sendBrokerMessage({
          clientId,
          body: trimmed,
          declarationId: activeThread.id,
        });
      } else {
        await sendBrokerMessage({
          clientId,
          body: trimmed,
          assessmentId: activeThread.id,
        });
      }
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const hasTargets =
    (declarations?.length ?? 0) > 0 || (assessments?.length ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <MessageSquare className="h-4 w-4 text-slate-400" />
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-black">Portal messages</h3>
          <p className="text-[11px] text-slate-500">
            Message the client about a declaration or export assessment
          </p>
        </div>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <label htmlFor="portal-thread" className={FORM_LABEL}>
            About
          </label>
          <Select
            value={brokerThreadValue(activeThread) || undefined}
            onValueChange={(value) => setThread(parseBrokerThreadValue(value))}
            disabled={!hasTargets}
          >
            <SelectTrigger id="portal-thread" className={cn(ENTERPRISE_SELECT_TRIGGER, "mt-1")}>
              <SelectValue
                placeholder={
                  hasTargets
                    ? "Choose a declaration or export assessment"
                    : "Link a declaration or assessment first"
                }
              />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className={ENTERPRISE_SELECT_CONTENT}>
              {(declarations ?? []).length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="px-2 py-1.5 text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                    Declarations
                  </SelectLabel>
                  {(declarations ?? []).map((d) => (
                    <SelectItem
                      key={d._id}
                      value={`declaration:${d._id}`}
                      className={ENTERPRISE_SELECT_ITEM}
                    >
                      {formatPortalFilingLabel(d)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
              {(assessments ?? []).length > 0 ? (
                <SelectGroup>
                  <SelectLabel className="px-2 py-1.5 text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                    Export controls
                  </SelectLabel>
                  {(assessments ?? []).map((a) => (
                    <SelectItem
                      key={a._id}
                      value={`assessment:${a._id}`}
                      className={ENTERPRISE_SELECT_ITEM}
                    >
                      {formatPortalCaseLabel(a)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        <PortalMessageThread
          messages={messages}
          viewerRole="broker"
          isIdle={!activeThread}
          idleLabel="Choose a declaration or export assessment to message on."
          emptyLabel="No messages yet. Ask for documents or share a status update."
        />

        <div>
          <label htmlFor="portal-message" className={FORM_LABEL}>
            Your message
          </label>
          <textarea
            id="portal-message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={
              activeThread
                ? "Ask for an invoice, packing list, or share a status update…"
                : "Choose what this is about first…"
            }
            disabled={!activeThread}
            className={FORM_TEXTAREA}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>

        {error && (
          <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
        )}

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isSending || !activeThread || body.trim().length < 1}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {isSending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Send message
        </button>
      </div>
    </div>
  );
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
  if (!client) {
    return (
      <div className="flex min-h-full flex-col">
        <SheetHeader className="sticky top-0 z-10 shrink-0 border-b border-slate-100 bg-white px-6 pt-6 pb-5 sm:px-8">
          <SheetTitle className="truncate text-lg font-semibold text-slate-900">…</SheetTitle>
          <SheetDescription className="mt-1 text-xs text-slate-500">
            Trader profile for declarations you file on their behalf
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 items-center gap-2 px-6 py-6 text-xs text-slate-500 sm:px-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading client…
        </div>
      </div>
    );
  }

  return (
    <ClientWorkspaceLoaded
      key={client._id}
      clientId={clientId}
      client={client}
      onArchive={onArchive}
      isArchiving={isArchiving}
    />
  );
}

function ClientWorkspaceLoaded({
  clientId,
  client,
  onArchive,
  isArchiving,
}: {
  clientId: Id<"clients">;
  client: NonNullable<ReturnType<typeof useQuery<typeof api.clients.get>>>;
  onArchive: () => Promise<void>;
  isArchiving: boolean;
}) {
  const updateClient = useMutation(api.clients.update);
  const [form, setForm] = useState<ClientForm>(() => clientToForm(client));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: keyof ClientForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
            <SheetTitle className="truncate text-lg font-semibold text-slate-900">{client.name}</SheetTitle>
            <SheetDescription className="mt-1 text-xs text-slate-500">
              Trader profile for declarations you file on their behalf
            </SheetDescription>
            <span
              className={cn(
                "mt-2 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                statusTone(client.status),
              )}
            >
              {client.status === "archived" ? "Archived" : "Active"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void onArchive()}
              disabled={isArchiving}
              className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isArchiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : client.status === "archived" ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
              {client.status === "archived" ? "Restore" : "Archive"}
            </button>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-6 px-6 py-6 sm:px-8">
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

        <ClientPortalAccessCard key={client._id} clientId={clientId} client={client} />
        <ClientPortalMessagesCard clientId={clientId} />
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(isClerkLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated);

  const createClient = useMutation(api.clients.create);
  const setStatus = useMutation(api.clients.setStatus);

  const [selectedClientId, setSelectedClientId] = useState<Id<"clients"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const clients = useQuery(
    api.clients.list,
    authReady ? { includeArchived: statusFilter !== "active" } : "skip",
  );
  const selectedClient = useQuery(
    api.clients.get,
    authReady && selectedClientId ? { clientId: selectedClientId } : "skip",
  );

  const isLoading = !authReady || clients === undefined;

  useEffect(() => {
    if (!showFilters) return;
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilters(false);
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

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
      const next = client.status === "archived" ? "active" : "archived";
      await setStatus({ clientId: client._id, status: next });
      if (selectedClientId === client._id && next === "archived" && statusFilter === "active") {
        closeClient();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSheetArchive = async () => {
    if (!selectedClient) return;
    setIsArchiving(true);
    try {
      const next = selectedClient.status === "archived" ? "active" : "archived";
      await setStatus({
        clientId: selectedClient._id,
        status: next,
      });
      if (next === "archived" && statusFilter === "active") closeClient();
    } finally {
      setIsArchiving(false);
    }
  };

  const filtered = useMemo(() => {
    const rows = clients ?? [];
    const byStatus =
      statusFilter === "all"
        ? rows
        : rows.filter((c) =>
            statusFilter === "archived" ? c.status === "archived" : c.status !== "archived",
          );
    const term = searchQuery.trim().toLowerCase();
    if (!term) return byStatus;
    return byStatus.filter((c) =>
      [c.name, c.eori, c.country, c.contactName, c.contactEmail]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [clients, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || statusFilter !== "active";

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

      <div className="relative z-10 flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-none">
        <div className="relative z-20 overflow-visible border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={(e) => {
                  setShowFilters((prev) => !prev);
                  e.currentTarget.blur();
                }}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-[0.6875rem] font-medium tracking-normal text-slate-600 outline-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-0",
                  statusFilter !== "active" || showFilters ? "border-slate-400" : "border-slate-200",
                )}
              >
                <Filter className="h-3 w-3" />
                Filter
              </button>
              {showFilters && (
                <div className="absolute right-0 top-10 z-[120] w-44 rounded-md border border-slate-200 bg-white p-2 shadow-md">
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={(e) => {
                        setStatusFilter(option.value);
                        setShowFilters(false);
                        e.currentTarget.blur();
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-xs outline-none hover:bg-slate-100 focus:outline-none focus-visible:ring-0",
                        statusFilter === option.value && "bg-slate-100 font-medium text-black",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-b-xl">
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
                        {hasActiveFilters ? "No matching clients" : "No clients yet"}
                      </h4>
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        {hasActiveFilters
                          ? "No clients match your search or selected filters."
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
