"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Bell } from "lucide-react";
import { AdminLoading } from "../page";

export default function AdminNotificationsPage() {
  const notifications = useQuery(api.admin_ops.getRecentNotifications, { limit: 50 });

  if (notifications === undefined) {
    return <AdminLoading label="Loading HMRC notification feed…" />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900">
          <Bell className="h-5 w-5 text-gray-400" />
          HMRC Notifications
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform-wide DMS feed — immutable HMRC correspondence for compliance and audit (4-year retention target).
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {notifications.length === 0 ? (
          <p className="px-6 py-12 text-center text-xs text-gray-500">No notifications stored yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50">
              <tr>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Time</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Type</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">MRN</th>
                <th className="px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <tr key={n.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 text-[11px] font-mono text-gray-500">
                    {n.timestamp ? new Date(n.timestamp).toLocaleString("en-GB") : "—"}
                  </td>
                  <td className="px-6 py-3 text-xs font-medium text-gray-900">{n.notificationType}</td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-600">{n.mrn || "—"}</td>
                  <td className="px-6 py-3 text-[10px] text-red-600">
                    {n.errorCodes?.length ? n.errorCodes.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-500">
        For declaration-level raw XML and amend/cancel actions, open the{" "}
        <Link href="/dashboard/admin/clerk" className="text-blue-600 hover:underline">
          declaration timeline
        </Link>
        .
      </p>
    </div>
  );
}
