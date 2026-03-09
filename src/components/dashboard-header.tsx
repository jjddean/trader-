"use client";

import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
    title: string;
    badge?: string;
    badgeVariant?: "default" | "success" | "blue";
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
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
    searchPlaceholder = "Search...",
    searchValue,
    onSearchChange,
    buttonLabel,
    onButtonClick,
    buttonDisabled,
    buttonIcon,
    className,
    children,
}: DashboardHeaderProps) => {
    return (
        <header className={cn("h-[56px] border-b border-gray-200 bg-white flex items-center justify-between px-6 z-[60] shrink-0 gap-8", className)}>
            <div className="flex items-center gap-4 min-w-0">
                <h1 className="text-sm font-normal text-black tracking-tight shrink-0">{title}</h1>
                {badge && (
                    <span className={cn(
                        "px-1.5 py-0.5 rounded text-[9px] border font-normal tracking-wide uppercase shrink-0",
                        badgeVariant === "default" && "bg-gray-100 text-gray-500 border-gray-200",
                        badgeVariant === "success" && "bg-green-50 text-green-600 border-green-100 font-medium",
                        badgeVariant === "blue" && "bg-blue-50 text-blue-600 border-blue-100 font-medium"
                    )}>
                        {badge}
                    </span>
                )}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {children}
                </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(e) => onSearchChange?.(e.target.value)}
                        className="h-[32px] pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                    />
                </div>
                {buttonLabel && (
                    <button
                        onClick={onButtonClick}
                        disabled={buttonDisabled}
                        className="h-[32px] px-3 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {buttonIcon}
                        {buttonLabel}
                    </button>
                )}
            </div>
        </header>
    );
};
