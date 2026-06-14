"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminLoading } from "../page";

type Subscription = {
  _id: Id<"admin_subscriptions">;
  service: string;
  plan: string;
  status: string;
  loginUrl: string;
  nextRenewal: number;
  notes?: string;
};

type StatusFilter = "all" | "active" | "expiring" | "suspended";

const EMPTY_FORM = {
  service: "",
  plan: "",
  status: "active",
  loginUrl: "",
  nextRenewal: Date.now() + 30 * 24 * 60 * 60 * 1000,
  notes: "",
};

function resolveStatus(status: string, nextRenewal: number): StatusFilter {
  if (status === "suspended") return "suspended";
  if (status === "expiring" || nextRenewal - Date.now() < 7 * 24 * 60 * 60 * 1000) return "expiring";
  return "active";
}

function formatRenewal(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status, nextRenewal }: { status: string; nextRenewal: number }) {
  const resolved = resolveStatus(status, nextRenewal);
  if (resolved === "active") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Active
      </span>
    );
  }
  if (resolved === "expiring") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <AlertTriangle className="h-3.5 w-3.5" /> Expiring
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
      <XCircle className="h-3.5 w-3.5" /> Suspended
    </span>
  );
}

export default function AdminSubscriptionsPage() {
  const subscriptions = useQuery(api.admin_subscriptions.list);
  const seedMutation = useMutation(api.admin_subscriptions.seedSubscriptions);
  const upsertMutation = useMutation(api.admin_subscriptions.upsert);
  const removeMutation = useMutation(api.admin_subscriptions.remove);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"admin_subscriptions"> | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const stats = useMemo(() => {
    if (!subscriptions) return { total: 0, active: 0, expiring: 0, suspended: 0 };
    const rows = subscriptions as Subscription[];
    return {
      total: rows.length,
      active: rows.filter((s) => resolveStatus(s.status, s.nextRenewal) === "active").length,
      expiring: rows.filter((s) => resolveStatus(s.status, s.nextRenewal) === "expiring").length,
      suspended: rows.filter((s) => resolveStatus(s.status, s.nextRenewal) === "suspended").length,
    };
  }, [subscriptions]);

  const filtered = useMemo(() => {
    if (!subscriptions) return [];
    const term = searchQuery.toLowerCase().trim();
    return (subscriptions as Subscription[]).filter((sub) => {
      const resolved = resolveStatus(sub.status, sub.nextRenewal);
      if (statusFilter !== "all" && resolved !== statusFilter) return false;
      if (!term) return true;
      const haystack = [sub.service, sub.plan, sub.notes, sub.loginUrl].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [subscriptions, searchQuery, statusFilter]);

  function openCreate() {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, nextRenewal: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    setDialogOpen(true);
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub._id);
    setFormData({
      service: sub.service,
      plan: sub.plan,
      status: sub.status,
      loginUrl: sub.loginUrl,
      nextRenewal: sub.nextRenewal,
      notes: sub.notes ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setEditingId(null);
      setFormData(EMPTY_FORM);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  }

  async function handleSeed() {
    try {
      const result = await seedMutation();
      toast.success(result);
    } catch (error) {
      toast.error(`Seed failed: ${(error as Error).message}`);
    }
  }

  async function handleUpsert() {
    if (!formData.service.trim() || !formData.loginUrl.trim()) {
      toast.error("Service name and login URL are required");
      return;
    }
    try {
      await upsertMutation({
        ...(editingId ? { id: editingId } : {}),
        ...formData,
      });
      closeDialog(false);
      toast.success(editingId ? "Service updated" : "Service added");
    } catch (error) {
      toast.error(`Save failed: ${(error as Error).message}`);
    }
  }

  async function handleDelete(id: Id<"admin_subscriptions">) {
    if (!confirm("Remove this vendor entry?")) return;
    try {
      await removeMutation({ id });
      toast.success("Removed");
    } catch (error) {
      toast.error(`Delete failed: ${(error as Error).message}`);
    }
  }

  if (subscriptions === undefined) {
    return <AdminLoading label="Loading vendor stack…" />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900">
            <CreditCard className="h-5 w-5 text-gray-400" />
            Vendor Stack
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Internal SaaS and API subscriptions (Convex, Clerk, HMRC Dev Hub) — not client duty payments.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-black px-4 text-xs font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add service
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Services" value={stats.total} hint="Tracked vendors" />
        <StatTile label="Active" value={stats.active} hint="Renewal more than 7 days" />
        <StatTile label="Expiring" value={stats.expiring} accent={stats.expiring > 0 ? "warn" : undefined} hint="Within 7 days" />
        <StatTile label="Suspended" value={stats.suspended} accent={stats.suspended > 0 ? "danger" : undefined} hint="Paused or cancelled" />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search service, plan, notes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-gray-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring</option>
          <option value="suspended">Suspended</option>
        </select>
        <span className="text-xs tabular-nums text-gray-400">{filtered.length} shown</span>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Subscriptions &amp; API accounts</h2>
          <p className="mt-0.5 text-xs text-gray-500">Manual ops register — login links only, no credentials stored.</p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-xs text-gray-500">No vendor entries yet.</p>
            <button
              type="button"
              onClick={handleSeed}
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Seed default stack (Convex, Clerk, HMRC, etc.)
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-xs text-gray-500">No services match your filters.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Service</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Plan</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Renewal</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Dashboard</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Notes</th>
                <th className="px-6 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((sub) => (
                <tr key={sub._id} className="group align-top hover:bg-gray-50/50">
                  <td className="px-6 py-3">
                    <p className="text-xs font-semibold text-gray-900">{sub.service}</p>
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-600">{sub.plan}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={sub.status} nextRenewal={sub.nextRenewal} />
                  </td>
                  <td className="px-6 py-3 font-mono text-[11px] text-gray-500">{formatRenewal(sub.nextRenewal)}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1">
                      <a
                        href={sub.loginUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(sub.loginUrl)}
                        className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                        title="Copy URL"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="max-w-[180px] px-6 py-3">
                    <p className="truncate text-[11px] text-gray-500" title={sub.notes}>
                      {sub.notes || "—"}
                    </p>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(sub)}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sub._id)}
                        className="rounded p-1.5 text-red-500 hover:bg-red-50"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-gray-100 px-6 py-3">
          <Link href="/dashboard/admin/setup" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            Users &amp; HMRC connectivity <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Renewal dates are manual reminders only — they do not sync with vendor billing APIs. Update entries when plans change.
      </p>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingId ? "Edit service" : "Add service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Service / API name">
              <input
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                placeholder="e.g. Convex"
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Plan">
                <input
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  placeholder="Pro / PAYG"
                  className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
                />
              </FormField>
              <FormField label="Status">
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
                >
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="suspended">Suspended</option>
                </select>
              </FormField>
            </div>
            <FormField label="Dashboard URL">
              <input
                value={formData.loginUrl}
                onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                placeholder="https://…"
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
              />
            </FormField>
            <FormField label="Next renewal">
              <input
                type="date"
                value={new Date(formData.nextRenewal).toISOString().slice(0, 10)}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nextRenewal: new Date(e.target.value).getTime() || formData.nextRenewal,
                  })
                }
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
              />
            </FormField>
            <FormField label="Notes (internal)">
              <input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional"
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
              />
            </FormField>
            <button
              type="button"
              onClick={handleUpsert}
              className="h-9 w-full rounded-md bg-black text-xs font-medium text-white hover:bg-gray-800"
            >
              {editingId ? "Save changes" : "Add service"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  accent?: "warn" | "danger";
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          accent === "danger" && "text-red-700",
          accent === "warn" && "text-amber-700",
          !accent && "text-gray-900",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">{hint}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</label>
      {children}
    </div>
  );
}
