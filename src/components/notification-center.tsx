"use client";

/**
 * The in-app inbox panel.
 *
 * Layout follows the earlier Freightcode app's `notification-center.tsx` —
 * sentence-case heading with a close button, All/Unread/Urgent tabs carrying
 * counts, a mark-all-read row, severity-tinted rows — at this
 * app's type scale and using its Lucide icon set rather than emoji.
 *
 * Two deliberate departures from that file:
 *
 *  - Built on Radix `DropdownMenu` rather than a bare div with a `mousedown`
 *    listener, so it keeps the keyboard navigation, focus handling and aria
 *    roles the rest of the header already has.
 *  - The original applied a priority background and an unread background to the
 *    same element; under `twMerge` the second silently won, so unread urgent
 *    rows lost their red tint entirely. Unread is carried by weight and the dot
 *    here, leaving the priority tint to actually show.
 *
 * Reads `app_notifications`, never the HMRC evidence table.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  Inbox,
  KeyRound,
  Loader2,
  MessageSquare,
  Settings,
  Ship,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Filter = "all" | "unread" | "urgent";
type NotificationRow = Doc<"app_notifications">;

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "urgent", label: "Urgent" },
];

/** Icon per category, from the app's Lucide set. */
function iconFor(row: NotificationRow): LucideIcon {
  switch (row.category) {
    case "declaration":
      return FileText;
    case "cns":
      return Ship;
    case "documents":
      return FileText;
    case "finance":
    case "billing":
      return CreditCard;
    case "export_controls":
      return ShieldAlert;
    case "validation":
      return row.severity === "info" ? CheckCircle2 : AlertTriangle;
    case "portal":
      return MessageSquare;
    case "hmrc_auth":
      return KeyRound;
    case "admin":
      return Settings;
    default:
      return Bell;
  }
}

/** Row tint + icon colour, keyed on severity (the original's `priority`). */
function priorityClasses(severity: string): { row: string; icon: string } {
  switch (severity) {
    case "critical":
      return { row: "bg-red-50/60", icon: "text-red-600" };
    case "action_required":
      return { row: "bg-amber-50/60", icon: "text-amber-600" };
    default:
      return { row: "bg-white", icon: "text-slate-400" };
  }
}

function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "Just now";
  const diffMins = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function NotificationCenter() {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<Filter>("all");
  const router = useRouter();

  // Counts drive the badge and must stay live even while the panel is shut.
  const counts = useQuery(api.app_notifications.counts, {});
  // The list is only needed once the panel opens.
  const notifications = useQuery(
    api.app_notifications.listRecent,
    open ? { filter, limit: 20 } : "skip",
  );
  const markRead = useMutation(api.app_notifications.markRead);
  const markAllRead = useMutation(api.app_notifications.markAllRead);

  const unreadCount = counts?.unread ?? 0;

  const handleClick = React.useCallback(
    (row: NotificationRow) => {
      if (row.readAt === undefined) {
        void markRead({ notificationId: row._id });
      }
      if (row.href) {
        setOpen(false);
        router.push(row.href);
      }
    },
    [markRead, router],
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative flex h-[32px] w-[32px] items-center justify-center rounded-md border border-slate-200 bg-white transition-colors hover:bg-slate-50 active:scale-95"
        >
          <Bell className="h-3.5 w-3.5 stroke-[1.5] text-slate-400" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-500 px-1 text-[9px] font-semibold text-white">
              {formatCount(unreadCount)}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 overflow-hidden rounded-lg border-slate-200 bg-white p-0 shadow-xl"
      >
        <div className="border-b border-slate-100 px-3 pt-2.5 pb-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-900">Notifications</h3>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="text-slate-300 transition-colors hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex gap-1">
            {FILTERS.map((tab) => {
              const count =
                tab.key === "all"
                  ? (counts?.all ?? 0)
                  : tab.key === "unread"
                    ? unreadCount
                    : (counts?.urgent ?? 0);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
                    filter === tab.key
                      ? "bg-blue-100 text-blue-700"
                      : "text-slate-500 hover:bg-slate-100",
                  )}
                >
                  {tab.label} ({formatCount(count)})
                </button>
              );
            })}
          </div>
        </div>

        {unreadCount > 0 && (
          <div className="flex justify-end border-b border-slate-100 px-3 py-1.5">
            <button
              type="button"
              onClick={() => void markAllRead({})}
              className="text-[11px] font-medium text-slate-400 transition-colors hover:text-black"
            >
              Mark all as read
            </button>
          </div>
        )}

        <div className="h-[300px] overflow-y-auto">
          {notifications === undefined ? (
            <div className="flex h-full items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Inbox className="mx-auto mb-2 h-6 w-6 text-slate-300" strokeWidth={1.5} />
              <p className="text-xs text-slate-400">No notifications</p>
            </div>
          ) : (
            notifications.map((row) => {
              const Icon = iconFor(row);
              const tone = priorityClasses(row.severity);
              const unread = row.readAt === undefined;
              return (
                // A div rather than a button: the row carries a nested action
                // button, and a button inside a button is invalid HTML. Keyboard
                // access is restored explicitly below.
                <div
                  key={row._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleClick(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleClick(row);
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-start gap-2 border-b border-b-slate-100 px-3 py-2.5 text-left transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
                    tone.row,
                  )}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.icon)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-[13px] leading-tight",
                          unread ? "font-medium text-slate-900" : "text-slate-600",
                        )}
                      >
                        {row.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatTimestamp(row.createdAt)}
                      </span>
                    </div>
                    {row.body && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-slate-500">
                        {row.body}
                      </p>
                    )}
                    {row.href && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClick(row);
                        }}
                        className="mt-1.5 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-black"
                      >
                        View
                      </button>
                    )}
                  </div>
                  {unread && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
