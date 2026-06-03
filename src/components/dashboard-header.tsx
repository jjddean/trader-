"use client";

import React, { useState } from "react";
import { Search, Bell, Zap, CheckCircle2, FileText, Package, XCircle, Clock, Bot } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";

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
import { cn } from "@/lib/utils";
import { getNotificationDisplay } from "@/lib/notification-labels";
import { GlobalSearchOverlay } from "./global-search-overlay";
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

interface DashboardHeaderProps {
  title: string;
  badge?: string;
  badgeVariant?: "default" | "success" | "blue";
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
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
  const hmrcToken = useQuery(api.hmrc.getToken, userId ? { userId } : "skip");
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (hmrcToken === undefined) return null;

  let status = "not-connected";
  if (hmrcToken) {
    if (hmrcToken.expiresAt < now) status = "expired";
    else if (hmrcToken.expiresAt - now < 30 * 60 * 1000) status = "expiring";
    else status = "valid";
  }

  const dotColor =
    status === "valid" ? "bg-green-500" :
    status === "expiring" ? "bg-amber-500" :
    "bg-red-500";

  const label =
    status === "valid" ? "HMRC" :
    status === "expiring" ? "HMRC" :
    status === "expired" ? "HMRC" :
    "HMRC";

  const baseClass = "flex h-[32px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-black";

  if (status === "valid") {
    return (
      <div className={baseClass}>
        <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
        {label}
      </div>
    );
  }

  return (
    <a href="/api/hmrc/auth" className={baseClass}>
      <div className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </a>
  );
}

export const DashboardHeader = ({
  title,
  badge,
  badgeVariant = "default",
  showSearch = true,
  searchPlaceholder = "Global Search",
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  buttonLabel,
  onButtonClick,
  buttonDisabled,
  buttonIcon,
  className,
  children,
}: DashboardHeaderProps) => {
  const isControlled = typeof onSearchChange === "function";
  const [internalValue, setInternalValue] = React.useState(searchValue);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { user } = useUser();
  const userId = user?.id;
  const notifications = useQuery(api.notifications.getUserNotifications, userId ? { userId } : "skip");
  const unreadCount = notifications?.filter(n => !n.processed).length || 0;

  React.useEffect(() => {
    if (!isControlled) setInternalValue(searchValue);
  }, [isControlled, searchValue]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const value = isControlled ? searchValue : internalValue;
  const handleChange = (next: string) => {
    if (isControlled) onSearchChange?.(next);
    else setInternalValue(next);
  };

  return (
    <header
      className={cn(
        "z-[60] flex h-[48px] shrink-0 items-center justify-between gap-8 border-b border-gray-200 bg-white px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 size-5 [&_svg]:size-2.5 [&_svg]:stroke-[1.5]" />
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <h1 className="shrink-0 text-sm font-semibold tracking-normal text-black">{title}</h1>
        </div>
        {badge && (
          <span
            className={cn(
              "shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-normal tracking-wide uppercase",
              badgeVariant === "default" && "border-gray-200 bg-gray-100 text-gray-500",
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
        <GlobalSearchOverlay
          isOpen={isOverlayOpen}
          onClose={() => setIsOverlayOpen(false)}
        />
        {buttonLabel && (
          <button
            onClick={onButtonClick}
            disabled={buttonDisabled}
            className="flex h-[32px] items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal whitespace-nowrap text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonIcon}
            {buttonLabel}
          </button>
        )}

        <AssistantSideSheet>
          <button className="flex h-[32px] items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium whitespace-nowrap text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-black">
            <Bot className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline-block">Help</span>
          </button>
        </AssistantSideSheet>

        {mounted ? (
          <div className="flex items-center gap-3">
            <HmrcStatusIndicator />
            {showSearch && (
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 font-bold" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  onFocus={() => setIsOverlayOpen(true)}
                  onClick={() => setIsOverlayOpen(true)}
                  className="focus:border-ring focus:ring-ring/50 h-[32px] w-44 cursor-pointer rounded-md border border-gray-200 bg-gray-50 pr-3 pl-8 text-xs text-gray-700 transition-[color,box-shadow] outline-none focus:ring-[2px]"
                  readOnly
                />
              </div>
            )}
            <div className="h-4 w-px bg-gray-200" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex h-[32px] w-[32px] items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 active:scale-95">
                  <Bell className="h-3.5 w-3.5 text-gray-400 stroke-[1.5]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl border-gray-200 bg-white p-0 shadow-xl overflow-hidden">
              <div className="bg-gray-50/50 p-3 border-b border-gray-100 flex items-center justify-between">
                <DropdownMenuLabel className="p-0 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                  Notifications
                </DropdownMenuLabel>
                {unreadCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">{unreadCount} New</span>}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications === undefined ? (
                  <div className="p-4 text-center text-[11px] text-gray-400">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-gray-400">You're all caught up!</div>
                ) : (
                  notifications.map((n: any, idx: number) => {
                    const display = getNotificationDisplay(n.notificationType);
                    let Icon = Zap;
                    let bgColor = "bg-blue-50";
                    let iconColor = "text-blue-600";
                    let title = display.title;

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
                        <DropdownMenuItem className="flex items-start gap-3 p-3 focus:bg-gray-50 cursor-pointer transition-colors relative">
                          {!n.processed && <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5", bgColor)}>
                            <Icon className={cn("h-4 w-4", iconColor)} />
                          </div>
                          <div className="flex flex-col gap-0.5 w-full">
                            <div className="flex justify-between items-start w-full gap-2">
                              <p className="text-[13px] font-semibold text-black leading-tight line-clamp-1">{title}</p>
                              <span className="text-[9px] text-gray-400 whitespace-nowrap mt-0.5">{timeAgo(n.timestamp)}</span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-gray-500">
                              MRN: <span className="font-medium text-gray-700">{n.mrn || "Pending"}</span>
                              {display.subtitle ? (
                                <span className="block text-[10px] text-gray-400 mt-0.5">{display.subtitle}</span>
                              ) : null}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
              <div className="border-t border-gray-100 bg-gray-50/50 p-2">
                <button className="w-full rounded-md py-1 text-center text-[10px] font-medium text-gray-500 hover:text-black transition-colors">
                  View All Notifications
                </button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        ) : (
          <button className="flex h-[32px] w-[32px] items-center justify-center rounded-md border border-gray-200 bg-white">
            <Bell className="h-3.5 w-3.5 text-gray-400 stroke-[1.5]" />
          </button>
        )}
      </div>
    </header>
  );
};
