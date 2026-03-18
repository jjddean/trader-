"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Compass,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
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
  { href: "/dashboard/documents", label: "Smart Upload", icon: FileText },
  { href: "/dashboard/declarations", label: "Declarations", icon: Compass },
  { href: "/dashboard/audit", label: "Compliance Audit", icon: ShieldCheck },
  { href: "/dashboard/reports", label: "Customs Reports", icon: FileSpreadsheet },
  { href: "/dashboard/records", label: "Financial Records", icon: Scale },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userId = user?.id || "";
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Dynamic issue counting for the badge
  const lanes = useQuery(api.trade_lanes.getLanes, userId ? { userId } : "skip");
  const reviewCount = (lanes as any)?.filter((l: any) => l.status === "Review").length ?? 0;

  return (
    <Sidebar className="border-r border-gray-200 bg-gray-50">
      <SidebarHeader className="flex h-[48px] flex-row items-center border-b border-gray-200 px-6">
        <Link
          href="/"
          className="flex w-full items-center gap-2 text-black transition-opacity hover:opacity-80"
        >
          <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white">
            <span className="text-xs font-bold leading-none">f</span>
          </div>
          <span className="text-sm font-medium tracking-tight text-gray-900">
            freight<span className="font-bold text-black">code®</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex flex-col p-4 pt-0">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-0.5 px-3 text-[10px] font-normal tracking-widest text-gray-400 uppercase">
            Platform
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                const hasBadge = item.label === "Declarations" && reviewCount > 0;

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                        isActive
                          ? "bg-gray-100 text-black"
                          : "text-gray-500 hover:bg-gray-100 hover:text-black",
                      )}
                    >
                      <Link href={item.href} className="flex flex-1 items-center gap-2">
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive ? "text-gray-700" : "text-gray-400",
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {hasBadge && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">
                            {reviewCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto" />

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/settings"}
                  className={cn(
                    "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                    pathname === "/dashboard/settings"
                      ? "bg-gray-100 text-black"
                      : "text-gray-500 hover:bg-gray-100 hover:text-black",
                  )}
                >
                  <Link href="/dashboard/settings" className="flex flex-1 items-center gap-2">
                    <Settings
                      className={cn(
                        "h-3.5 w-3.5",
                        pathname === "/dashboard/settings" ? "text-gray-700" : "text-gray-400",
                      )}
                    />
                    <span className="flex-1">Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="space-y-3 p-4">
        {mounted ? (
          <div className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2">
            <UserButton />
            <div className="flex flex-col">
              <span className="max-w-[100px] truncate text-xs font-normal text-gray-700">
                {user?.fullName || "User"}
              </span>
              <span className="text-[10px] text-gray-400">Enterprise</span>
            </div>
          </div>
        ) : (
          <div className="flex h-[42px] items-center gap-2 rounded-md border border-gray-200 bg-gray-100 px-3 py-2">
            <div className="h-6 w-6 animate-pulse rounded-full bg-gray-200" />
            <div className="flex flex-col gap-1">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-2 w-10 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
