"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Compass,
  Loader2,
  Radio,
  Users,
} from "lucide-react";
import {
  DeclarationStatusBadge,
  declarationHumanSubtitle,
  mrnSubtitleClass,
  mrnTitleClass,
  resolveDeclarationRowBadge,
  rowTintClass,
} from "@/lib/declaration-status-display";
import { cn } from "@/lib/utils";

export default function AdminOverviewPage() {
  const router = useRouter();
  const overview = useQuery(api.admin_ops.getOverview);
  const hmrcEnv = process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox";

  if (overview === undefined) {
    return <AdminLoading label="Loading operations overview…" />;
  }

  if (overview === null) {
    return <AdminError message="Could not load admin overview. Check Convex logs." />;
  }

  const { declarationCounts, userCount, hmrcConnections, lastNotificationAt, actionQueue, recentNotifications } =
    overview;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Operations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customs broker control centre — action queue, HMRC feed, and platform health.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Needs action" value={declarationCounts.needsAction} href="/dashboard/admin/clerk?filter=needs-action" accent="danger" icon={<AlertTriangle className="h-4 w-4" />} hint="Rejections & validation errors" />
        <StatCard label="Live declarations" value={declarationCounts.total} href="/dashboard/admin/clerk" icon={<Compass className="h-4 w-4" />} hint={`${declarationCounts.draft} drafts · ${declarationCounts.accepted} accepted`} />
        <StatCard label="HMRC connected" value={`${hmrcConnections.active}/${hmrcConnections.total}`} href="/dashboard/admin/setup" icon={<Radio className="h-4 w-4" />} hint={hmrcConnections.expired > 0 ? `${hmrcConnections.expired} reconnect needed` : "OAuth tokens active"} />
        <StatCard label="Users" value={userCount} href="/dashboard/admin/setup" icon={<Users className="h-4 w-4" />} hint="Broker accounts on platform" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Action queue</h2>
              <p className="text-xs text-gray-500">Declarations needing broker intervention</p>
            </div>
            <Link href="/dashboard/admin/clerk?filter=needs-action" className="text-xs font-medium text-blue-600 hover:underline">
              View all
            </Link>
          </div>
          {actionQueue.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-gray-500">No declarations need action right now.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {actionQueue.map((row) => {
                const badge = resolveDeclarationRowBadge(row);
                const subtitle = declarationHumanSubtitle(badge.label, row.status, badge.tone);
                return (
                  <li key={row.declarationId}>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/declarations/${row.declarationId}/status`)}
                      className={cn("flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50", rowTintClass(badge.tone))}
                    >
                      <div>
                        <p className={cn("text-xs font-semibold", mrnTitleClass(badge.tone))}>{row.mrn || "Pending CDS"}</p>
                        <p className={cn("text-[10px] font-medium", mrnSubtitleClass(badge.tone))}>{subtitle}</p>
                      </div>
                      <DeclarationStatusBadge tone={badge.tone} label={badge.label} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-400" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recent HMRC notifications</h2>
                <p className="text-xs text-gray-500">Latest DMS events across all accounts</p>
              </div>
            </div>
            <Link href="/dashboard/admin/notifications" className="text-xs font-medium text-blue-600 hover:underline">
              Full feed
            </Link>
          </div>
          {recentNotifications.length === 0 ? (
            <p className="px-5 py-10 text-center text-xs text-gray-500">No notifications stored yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentNotifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-900">{n.notificationType}</p>
                    <span className="text-[10px] text-gray-400">
                      {n.timestamp ? new Date(n.timestamp).toLocaleString("en-GB") : "—"}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-gray-500">{n.mrn || "No MRN"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="text-sm font-semibold text-gray-900">Platform</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">HMRC environment</dt>
            <dd className="mt-1 text-xs font-semibold uppercase text-amber-800">{hmrcEnv}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Last notification</dt>
            <dd className="mt-1 text-xs font-medium text-gray-900">
              {lastNotificationAt ? new Date(lastNotificationAt).toLocaleString("en-GB") : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Accepted declarations</dt>
            <dd className="mt-1 flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {declarationCounts.accepted}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, href, icon, accent }: { label: string; value: string | number; hint: string; href: string; icon: React.ReactNode; accent?: "danger" }) {
  return (
    <Link href={href} className="rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 hover:bg-gray-50/50">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", accent === "danger" ? "text-red-700" : "text-gray-900")}>{value}</p>
      <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
    </Link>
  );
}

export function AdminLoading({ label }: { label: string }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg p-8 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      <Link href="/dashboard/admin" className="mt-3 inline-block text-xs text-blue-600 hover:underline">
        Retry
      </Link>
    </div>
  );
}
