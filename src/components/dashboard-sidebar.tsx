"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShieldCheck,
    Users,
    Calculator,
    Inbox,
    Bot,
    Settings,
    Compass,
} from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
    { href: "/dashboard/prospects", label: "Prospects", icon: Users },
    { href: "/dashboard/calculator", label: "Calculator", icon: Calculator },
    { href: "/dashboard/inbox", label: "Inbox", icon: Inbox },
    { href: "/dashboard/assistant", label: "Assistant", icon: Bot },
];

const bottomItems = [
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export const DashboardSidebar = () => {
    const pathname = usePathname();
    const { user } = useUser();

    return (
        <aside className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col z-30 h-screen">
            <div className="h-14 flex items-center px-5 border-b border-gray-200">
                <div className="flex items-center gap-2 text-black">
                    <Compass className="h-5 w-5 text-gray-700" />
                    <span className="font-normal text-sm tracking-tight text-gray-900">
                        TradeDNA <span className="text-black font-semibold">Pro</span>
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-1">
                <p className="px-3 text-[0.5625rem] font-normal text-gray-400 uppercase tracking-widest mb-2">
                    Platform
                </p>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/dashboard" && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-normal transition-colors rounded-md",
                                isActive
                                    ? "text-black bg-gray-100 border border-gray-200"
                                    : "text-gray-500 hover:text-black hover:bg-gray-100"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? "text-gray-700" : "text-gray-400"
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}
            </div>

            <div className="mt-auto p-3 border-t border-gray-200">
                {bottomItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-normal transition-colors rounded-md mb-2",
                                isActive
                                    ? "text-black bg-gray-100 border border-gray-200"
                                    : "text-gray-500 hover:text-black hover:bg-gray-100"
                            )}
                        >
                            <Icon
                                className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? "text-gray-700" : "text-gray-400"
                                )}
                            />
                            {item.label}
                        </Link>
                    );
                })}

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md border border-gray-200">
                    <UserButton />
                    <div className="flex flex-col">
                        <span className="text-[0.6875rem] font-normal text-gray-700 truncate max-w-[100px]">
                            {user?.fullName || "User"}
                        </span>
                        <span className="text-[0.5625rem] text-gray-400">Enterprise</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};
