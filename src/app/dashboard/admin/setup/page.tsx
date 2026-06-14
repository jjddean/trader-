"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { CheckCircle2, ExternalLink, Loader2, Radio, Users, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface HealthPayload {
  status: string;
  environment: string;
  services: { convex: boolean; hmrc: boolean; clerk: boolean };
}

export default function AdminHmrcPage() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const panel = useQuery(
    api.admin_ops.getIntegrationPanel,
    isAuthenticated ? {} : "skip",
  );
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);

  const hmrcEnv = process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox";
  const publicEori = process.env.NEXT_PUBLIC_HMRC_EORI || "Not set in env";

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data as HealthPayload))
      .catch(() => setHealthError("Could not reach /api/health"));
  }, []);

  useEffect(() => {
    if (panel !== undefined) return;
    const timer = window.setTimeout(() => setSlowLoad(true), 8000);
    return () => window.clearTimeout(timer);
  }, [panel]);

  const hmrcConnections = panel?.hmrcConnections ?? [];
  const platformUsers = panel?.platformUsers ?? [];
  const panelLoading = isAuthLoading || (isAuthenticated && panel === undefined);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Users &amp; HMRC</h1>
        <p className="mt-1 text-sm text-gray-500">
          Environment, service connectivity, OAuth connections, and synced users.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <EnvCard label="HMRC environment" value={hmrcEnv.toUpperCase()} />
        <EnvCard label="API host" value={health?.environment ?? "—"} />
        <EnvCard label="Default EORI (env)" value={publicEori} mono />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Service connectivity</h2>
          <p className="mt-0.5 text-xs text-gray-500">From GET /api/health — env vars populated, not live latency tests.</p>
        </div>
        <div className="grid grid-cols-1 gap-px bg-gray-100 sm:grid-cols-3">
          <ServiceTile name="Convex" ok={health?.services.convex} loading={!health && !healthError} />
          <ServiceTile name="HMRC OAuth" ok={health?.services.hmrc} loading={!health && !healthError} />
          <ServiceTile name="Clerk" ok={health?.services.clerk} loading={!health && !healthError} />
        </div>
        {healthError && (
          <p className="border-t border-gray-100 px-6 py-3 text-xs text-red-600">{healthError}</p>
        )}
      </section>

      {panelLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          Loading users and HMRC connections…
          {slowLoad && (
            <span className="text-gray-500">
              — If this persists, run <code className="rounded bg-white px-1">npx convex dev</code> and refresh.
            </span>
          )}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">HMRC OAuth connections</h2>
            <p className="mt-0.5 text-xs text-gray-500">Per-user tokens in Convex — no secrets shown.</p>
          </div>
          <a
            href="/api/hmrc/auth"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-medium text-white hover:bg-gray-800"
          >
            <Radio className="h-3.5 w-3.5" />
            Connect HMRC (this account)
          </a>
        </div>
        {panelLoading ? (
          <PanelSkeleton rows={2} />
        ) : hmrcConnections.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-gray-500">
            No HMRC tokens yet. Click <strong>Connect HMRC</strong> above, or use Settings in the broker app.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">User</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">EORI</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Token expires</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hmrcConnections.map((row) => (
                <tr key={row.userId} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 text-xs font-medium text-gray-900">
                    {row.ownerEmail || row.ownerName || row.userId.slice(0, 16)}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">{row.eori || "—"}</td>
                  <td className="px-6 py-3 text-xs text-gray-600">
                    {row.expiresAt ? new Date(row.expiresAt).toLocaleString("en-GB") : "—"}
                  </td>
                  <td className="px-6 py-3">
                    {row.isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                        <XCircle className="h-3.5 w-3.5" /> Reconnect
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-gray-100 px-6 py-3">
          <Link href="/dashboard/settings" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
            User-facing HMRC settings <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-gray-400" />
            Platform users
          </h2>
        </div>
        {panelLoading ? (
          <PanelSkeleton rows={3} />
        ) : platformUsers.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-gray-500">
            No users synced from Clerk yet — sign in once to create your row in Convex.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Role</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">HMRC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {platformUsers.map((user) => (
                <tr key={user.clerkId} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3">
                    <p className="text-xs font-medium text-gray-900">{user.email || "—"}</p>
                    {user.name && <p className="text-[10px] text-gray-400">{user.name}</p>}
                  </td>
                  <td className="px-6 py-3 text-xs capitalize text-gray-600">{user.role || "user"}</td>
                  <td className="px-6 py-3 text-xs text-gray-600">
                    {user.hmrcConnected ? (
                      <span className="text-green-700">Connected{user.hmrcEori ? ` · ${user.hmrcEori}` : ""}</span>
                    ) : (
                      <span className="text-gray-400">Not connected</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 px-6 py-6">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
      ))}
    </div>
  );
}

function EnvCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <p className={cn("mt-2 text-sm font-semibold text-gray-900", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function ServiceTile({ name, ok, loading }: { name: string; ok?: boolean; loading?: boolean }) {
  return (
    <div className="bg-white px-6 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{name}</p>
      {loading ? (
        <Loader2 className="mt-2 h-4 w-4 animate-spin text-gray-400" />
      ) : ok ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Configured
        </p>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700">
          <XCircle className="h-3.5 w-3.5" /> Missing env
        </p>
      )}
    </div>
  );
}
