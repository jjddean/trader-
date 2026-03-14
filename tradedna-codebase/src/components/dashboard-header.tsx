"use client";

import React, { useState } from "react";
import { Search, Bell, Zap, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearchOverlay } from "./global-search-overlay";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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

  React.useEffect(() => {
    if (!isControlled) setInternalValue(searchValue);
  }, [isControlled, searchValue]);

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
          <h1 className="shrink-0 text-sm font-semibold tracking-tight text-black">{title}</h1>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex h-[32px] w-[32px] items-center justify-center rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 active:scale-95">
              <Bell className="h-3.5 w-3.5 text-gray-400 stroke-[1.5]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 rounded-xl border-gray-200 bg-white p-0 shadow-xl overflow-hidden">
            <div className="bg-gray-50/50 p-3 border-b border-gray-100">
              <DropdownMenuLabel className="p-0 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                Notifications
              </DropdownMenuLabel>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              <DropdownMenuItem className="flex items-start gap-3 p-3 focus:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
                  <Zap className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-black leading-tight">New Prospect Found</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Bangladesh Garments Ltd matches your <span className="font-medium text-gray-700">HS 6109</span> lane filters.
                  </p>
                  <span className="mt-1 text-[10px] text-gray-400">2 mins ago</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="m-0" />
              
              <DropdownMenuItem className="flex items-start gap-3 p-3 focus:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-black leading-tight">Compliance Alert</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    New DCTS rules for <span className="font-medium text-gray-700">Vietnam</span> will be effective next month.
                  </p>
                  <span className="mt-1 text-[10px] text-gray-400">1 hour ago</span>
                </div>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="m-0" />
              
              <DropdownMenuItem className="flex items-start gap-3 p-3 focus:bg-gray-50 cursor-pointer transition-colors">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold text-black leading-tight">Verification Complete</p>
                  <p className="text-[11px] leading-relaxed text-gray-500">
                    Your trade lane to <span className="font-medium text-gray-700">Cambodia</span> has been successfully verified.
                  </p>
                  <span className="mt-1 text-[10px] text-gray-400">3 hours ago</span>
                </div>
              </DropdownMenuItem>
            </div>
            <div className="border-t border-gray-100 bg-gray-50/50 p-2">
              <button className="w-full rounded-md py-1 text-center text-[10px] font-medium text-gray-500 hover:text-black transition-colors">
                View All Notifications
              </button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
