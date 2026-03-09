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
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
} from "@/components/ui/sidebar";

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

export function AppSidebar() {
    const pathname = usePathname();
    const { user } = useUser();
    const userId = user?.id || "";
    
    // Dynamic issue counting for the badge
    const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip");
    type Lane = { status: string };
    const reviewCount = lanes?.filter((l: Lane) => l.status === "Review").length ?? 0;

    return (
        <Sidebar className="border-r border-gray-200 bg-gray-50">
            <SidebarHeader className="h-14 flex items-center px-5 border-b border-gray-200 justify-center">
                <Link href="/" className="flex items-center gap-2 text-black hover:opacity-80 transition-opacity w-full">
                    <Compass className="h-5 w-5 text-gray-700" />
                    <span className="font-normal text-xs tracking-tight text-gray-900">
                        TradeDNA <span className="text-black font-semibold">Pro</span>
                    </span>
                </Link>
            </SidebarHeader>

            <SidebarContent className="p-4 pt-6 space-y-6">
                <SidebarGroup className="p-0">
                    <SidebarGroupLabel className="px-3 text-[10px] font-normal text-gray-400 uppercase tracking-widest mb-2">
                        Platform
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className="space-y-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive =
                                    pathname === item.href ||
                                    (item.href !== "/dashboard" && pathname.startsWith(item.href));

                                return (
                                    <SidebarMenuItem key={item.label}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-normal transition-colors rounded-md h-auto",
                                                isActive
                                                    ? "text-black bg-gray-100 border border-gray-200"
                                                    : "text-gray-500 hover:text-black hover:bg-gray-100"
                                            )}
                                        >
                                            <Link href={item.href}>
                                                <Icon
                                                    className={cn(
                                                        "h-3.5 w-3.5",
                                                        isActive ? "text-gray-700" : "text-gray-400"
                                                    )}
                                                />
                                                <span>{item.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-3 border-t border-gray-200 space-y-3">
                <SidebarMenu>
                    {bottomItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <SidebarMenuItem key={item.label}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs font-normal transition-colors rounded-md h-auto",
                                        isActive
                                            ? "text-black bg-gray-100 border border-gray-200"
                                            : "text-gray-500 hover:text-black hover:bg-gray-100"
                                    )}
                                >
                                    <Link href={item.href}>
                                        <Icon
                                            className={cn(
                                                "h-3.5 w-3.5",
                                                isActive ? "text-gray-700" : "text-gray-400"
                                            )}
                                        />
                                        <span>{item.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>

                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md border border-gray-200">
                    <UserButton />
                    <div className="flex flex-col">
                        <span className="text-xs font-normal text-gray-700 truncate max-w-[100px]">
                            {user?.fullName || "User"}
                        </span>
                        <span className="text-[10px] text-gray-400">Enterprise</span>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
