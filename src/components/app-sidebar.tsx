"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Settings,
  Compass,
  ShieldCheck,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useOrganization, useUser } from "@clerk/nextjs";
import { SidebarUserButton } from "@/components/auth/sidebar-user-button";
import { SidebarGlobalSearch } from "@/components/sidebar-global-search";
import { useQuery, useConvexAuth } from "convex/react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/documents", label: "Documents", icon: FileText },
  { href: "/dashboard/declarations", label: "Declarations", icon: Compass },
  {
    label: "Compliance",
    icon: ShieldCheck,
    items: [
      { href: "/dashboard/trade-compliance", label: "Export Control" },
      { href: "/dashboard/tools/hscode-lookup", label: "HS Code Lookup" },
      { href: "/dashboard/tre-import", label: "Import TRE" },
      { href: "/dashboard/reports", label: "Customs Reports" },
      { href: "/dashboard/records", label: "Financial Records" },
    ],
  },
];



export function AppSidebar() {
  const pathname = usePathname();
  const { user: clerkUser } = useUser();
  const { organization } = useOrganization();
  const { isAuthenticated } = useConvexAuth();
  const userData = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = userData?.role === "admin";

  const declarationCounts = useQuery(
    api.declarations.getMyDeclarationCounts,
    isAuthenticated ? {} : "skip",
  );
  const reviewCount = declarationCounts?.reviewCount ?? 0;

  return (
    <Sidebar className="!h-screen border-r border-slate-200 bg-white [&_[data-sidebar=sidebar]]:bg-white">
      <SidebarHeader className="flex h-[55px] shrink-0 flex-row items-center border-b border-slate-200 px-6">
        <Link
          href="/"
          className="flex w-full items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
            <span className="text-lg font-bold tracking-tight">freight</span>
            <span className="text-lg font-bold tracking-tight text-slate-500">code</span>
            <span className="font-normal text-[11px] -translate-y-[4px] ml-[-1px] text-slate-500">®</span>
          </div>
        </Link>
      </SidebarHeader>

      <div className="shrink-0 px-4 py-2">
        <SidebarGlobalSearch />
      </div>

      <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-1 pt-0">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-0 px-2 text-[10px] font-normal tracking-widest text-slate-400 uppercase">
            {isAdmin ? "Control Plane" : "Platform"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map((item) => {
                const Icon = (item as any).icon;
                const hasItems = "items" in item && item.items && item.items.length > 0;
                
                if (hasItems) {
                  const isAnyChildActive = item.items?.some(subItem => 
                    pathname === subItem.href || (subItem.href !== "/dashboard" && pathname.startsWith(subItem.href))
                  );
                  const defaultExpanded = item.label === "Compliance" ? true : isAnyChildActive;

                  return (
                    <Collapsible
                      key={item.label}
                      asChild
                      defaultOpen={defaultExpanded}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            tooltip={item.label}
                            className={cn(
                              "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                              isAnyChildActive ? "text-black" : "text-slate-500 hover:bg-slate-100 hover:text-black"
                            )}
                          >
                            <Icon className={cn("h-3.5 w-3.5", isAnyChildActive ? "text-slate-700" : "text-slate-400")} />
                            <span className="flex-1">{item.label}</span>
                            <ChevronRight className="ml-auto h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent forceMount className="data-[state=closed]:hidden">
                          <SidebarMenuSub className="ml-5 border-l border-slate-200 pl-2">
                            {item.items?.map((subItem) => {
                              const isSubActive = pathname === subItem.href || (subItem.href !== "/dashboard" && pathname.startsWith(subItem.href));
                              return (
                                <SidebarMenuSubItem key={subItem.label}>
                                  <SidebarMenuSubButton 
                                    asChild 
                                    isActive={isSubActive}
                                    className={cn(
                                      "px-2 py-1 text-xs font-normal",
                                      isSubActive ? "text-black font-medium" : "text-slate-500 hover:text-black"
                                    )}
                                  >
                                    <Link href={subItem.href}>
                                      <span>{subItem.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                const isActive =
                  pathname === (item as any).href ||
                  ((item as any).href !== "/dashboard" && pathname.startsWith((item as any).href));

                const hasBadge = item.label === "Declarations" && reviewCount > 0;

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={cn(
                        "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                        isActive
                          ? "bg-slate-100 text-black"
                          : "text-slate-500 hover:bg-slate-100 hover:text-black",
                      )}
                    >
                      <Link href={(item as any).href} className="flex flex-1 items-center gap-2">
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            isActive ? "text-slate-700" : "text-slate-400",
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

        {isAdmin && (
          <SidebarGroup className="p-0 mt-2">
            <SidebarGroupLabel className="mb-0 px-2 text-[10px] font-normal tracking-widest text-slate-400 uppercase">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/dashboard/admin")}
                    className={cn(
                      "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                      pathname.startsWith("/dashboard/admin")
                        ? "bg-slate-100 text-black"
                        : "text-slate-500 hover:bg-slate-100 hover:text-black",
                    )}
                  >
                    <Link href="/dashboard/admin" className="flex flex-1 items-center gap-2">
                      <Shield className={cn("h-3.5 w-3.5", pathname.startsWith("/dashboard/admin") ? "text-slate-700" : "text-slate-400")} />
                      <span className="flex-1">Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}




      </SidebarContent>

      <SidebarFooter className="mt-auto shrink-0 space-y-1.5 bg-white p-2">
        <SidebarMenu className="space-y-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/dashboard/settings"}
              className={cn(
                "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                pathname === "/dashboard/settings"
                  ? "bg-slate-100 text-black"
                  : "text-slate-500 hover:bg-slate-100 hover:text-black",
              )}
            >
              <Link href="/dashboard/settings" className="flex flex-1 items-center gap-2">
                <Settings
                  className={cn(
                    "h-3.5 w-3.5",
                    pathname === "/dashboard/settings" ? "text-slate-700" : "text-slate-400",
                  )}
                />
                <span className="flex-1">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
          <SidebarUserButton />
          <div className="flex min-w-0 flex-col">
            <span className="max-w-[100px] truncate text-xs font-normal text-slate-700">
              {clerkUser?.fullName || "User"}
            </span>
            <span className="max-w-[100px] truncate text-[10px] text-slate-400">
              {isAdmin ? "Admin" : organization?.name ?? "Personal account"}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
