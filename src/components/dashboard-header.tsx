"use client";

import React from "react";
import Link from "next/link";
import { Bell, Zap, CheckCircle2, FileText, Package, XCircle, Clock, Bot } from "lucide-react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { getNotificationDisplay } from "@/lib/notification-labels";
import { OrgSwitcher } from "@/components/auth/org-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AssistantSideSheet } from "@/components/assistant-side-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function timeAgo(dateString: string) {
  if (!dateString) return "just now";
  const date = new Date(dateString);
  const diffMs = new Date().getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) return `${Math.max(1, diffMins)} mins ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${Math.round(diffHours / 24)} days ago`;
}

interface DashboardHeaderProps {
  title: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "blue";
  buttonLabel?: string;
  onButtonClick?: () => void;
  buttonDisabled?: boolean;
  buttonIcon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

function HmrcStatusIndicator() {
  const { user } = useUser();
  const userId = user?.id;
  const hmrcConnection = useQuery(api.hmrc_internal.getTokens, userId ? { userId } : "skip");
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (hmrcConnection === undefined) {
    return (
      <div
        className="flex h-[32px] w-[72px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-400 shadow-sm"
        aria-hidden
      >
        <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
        HMRC
      </div>
    );
  }

  let status = "not-connected";
  if (hmrcConnection) {
    if (hmrcConnection.expiresAt < now) status = "expired";
    else if (hmrcConnection.expiresAt - now < 30 * 60 * 1000) status = "expiring";
    else status = "valid";
  }

  const dotColor =
    status === "valid" ? "bg-green-500" :
    status === "expiring" ? "bg-amber-500" :
    "bg-red-500";

  const label = "HMRC";

  const baseClass =
    "flex h-[32px] w-[72px] shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-black";

  if (status === "valid") {
    return (
      <Link href="/dashboard/settings" className={baseClass}>
        <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {label}
      </Link>
    );
  }

  return (
    <a href="/api/hmrc/auth" className={baseClass}>
      <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </a>
  );
}

function HeaderOrgSwitcher({ hidePersonal }: { hidePersonal?: boolean }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="h-8 w-[160px] shrink-0 rounded-md border border-slate-200 bg-white shadow-sm"
        aria-hidden
      />
    );
  }

  return <OrgSwitcher hidePersonal={hidePersonal} />;
}

export const DashboardHeader = ({
  title,
  badge,
  badgeVariant = "default",
  buttonLabel,
  onButtonClick,
  buttonDisabled,
  buttonIcon,
  className,
  children,
}: DashboardHeaderProps) => {
  const { user } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const userId = user?.id;
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const notifications = useQuery(api.notifications.getUserNotifications, userId ? { userId } : "skip");
  const unreadCount = notifications?.filter((n) => !n.processed).length || 0;

  return (
    <header
      className={cn(
        "z-[60] flex h-[55px] shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-slate-50 px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 size-5 [&_svg]:size-2.5 [&_svg]:stroke-[1.5]" />
          <div className="h-4 w-px bg-slate-200 mx-1" />
          <h1 className="shrink-0 text-sm font-semibold tracking-normal text-slate-900">{title}</h1>
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-normal tracking-wide uppercase",
              badgeVariant === "default" && "border-slate-200 bg-slate-100 text-slate-500",
              badgeVariant === "success" &&
                "border-green-100 bg-green-50 font-medium text-green-600",
              badgeVariant === "blue" && "border-blue-100 bg-blue-50 font-medium text-blue-600",
            )}
          >
            {badge}
          </span>
        )}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">{children}</div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4">
        {buttonLabel && (
          <button
            onClick={onButtonClick}
            disabled={buttonDisabled}
            className="flex h-[32px] items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal whitespace-nowrap text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonIcon}
            {buttonLabel}
          </button>
        )}

        <AssistantSideSheet>
          <button className="flex h-[32px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium whitespace-nowrap text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-black">
            <Bot className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline-block">Help</span>
          </button>
        </AssistantSideSheet>

        <div className="flex shrink-0 items-center gap-3">
          <HmrcStatusIndicator />
          <HeaderOrgSwitcher hidePersonal={dbUser?.role !== "admin"} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex h-[32px] w-[32px] items-center justify-center rounded-md border border-slate-200 bg-white transition-colors hover:bg-slate-50 active:scale-95">
                <Bell className="h-3.5 w-3.5 text-slate-400 stroke-[1.5]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl border-slate-200 bg-white p-0 shadow-xl overflow-hidden">
              <div className="bg-slate-50/50 p-3 border-b border-slate-100 flex items-center justify-between">
                <DropdownMenuLabel className="p-0 text-[10px] font-semibold tracking-widest text-slate-400 uppercase">
                  Notifications
                </DropdownMenuLabel>
                {unreadCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{unreadCount} New</span>}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications === undefined ? (
                  <div className="p-4 text-center text-[11px] text-slate-400">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-400">You&apos;re all caught up!</div>
                ) : (
                  notifications.map((n: any, idx: number) => {
                    const display = getNotificationDisplay(n.notificationType);
                    let Icon = Zap;
                    let bgColor = "bg-blue-50";
                    let iconColor = "text-blue-600";
                    let notificationTitle = display.title;

                    if (display.tone === "success") {
                      Icon = CheckCircle2;
                      bgColor = "bg-green-50";
                      iconColor = "text-green-600";
                    } else if (display.tone === "danger") {
                      Icon = XCircle;
                      bgColor = "bg-red-50";
                      iconColor = "text-red-600";
                    } else if (display.tone === "warning") {
                      Icon = Clock;
                      bgColor = "bg-amber-50";
                      iconColor = "text-amber-600";
                    } else if (n.notificationType === "GOODS_ARRIVED") {
                      Icon = Package;
                    } else if (n.notificationType === "DOCUMENTS_REQUIRED") {
                      Icon = FileText;
                      bgColor = "bg-amber-50";
                      iconColor = "text-amber-600";
                    }

                    return (
                      <React.Fragment key={n._id}>
                        {idx > 0 && <DropdownMenuSeparator className="m-0" />}
                        <DropdownMenuItem className="flex items-start gap-3 p-3 focus:bg-slate-50 cursor-pointer transition-colors relative">
                          {!n.processed && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5", bgColor)}>
                            <Icon className={cn("h-4 w-4", iconColor)} />
                          </div>
                          <div className="flex flex-col gap-0.5 w-full">
                            <div className="flex justify-between items-start w-full gap-2">
                              <p className="text-[13px] font-semibold text-black leading-tight line-clamp-1">{notificationTitle}</p>
                              <span className="text-[9px] text-slate-400 whitespace-nowrap mt-0.5">{timeAgo(n.timestamp)}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-500">
                              MRN: <span className="font-medium text-slate-700">{n.mrn || "Pending"}</span>
                              {display.subtitle ? (
                                <span className="block text-[10px] text-slate-400 mt-0.5">{display.subtitle}</span>
                              ) : null}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
              <div className="border-t border-slate-100 bg-slate-50/50 p-2">
                <button className="w-full rounded-md py-1 text-center text-[10px] font-medium text-slate-500 hover:text-black transition-colors">
                  View All Notifications
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
