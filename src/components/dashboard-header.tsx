"use client";

import React from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "@/components/auth/org-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AssistantSideSheet } from "@/components/assistant-side-sheet";
import { NotificationCenter } from "@/components/notification-center";

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

function HeaderOrgSwitcher({ hidePersonal }: { hidePersonal?: boolean }) {
  return (
    <div className="shrink-0" suppressHydrationWarning>
      <OrgSwitcher hidePersonal={hidePersonal} />
    </div>
  );
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
  const { isAuthenticated } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");

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
          <h1 className="max-w-[14rem] truncate shrink-0 text-sm font-semibold tracking-normal text-slate-900 sm:max-w-[18rem]">
            {title}
          </h1>
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
            Help
          </button>
        </AssistantSideSheet>

        <div className="flex shrink-0 items-center gap-3">
          <HeaderOrgSwitcher hidePersonal={dbUser?.role !== "admin"} />
          <NotificationCenter />
        </div>
      </div>
    </header>
  );
};
