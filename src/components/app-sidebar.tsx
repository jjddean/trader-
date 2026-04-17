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
  HelpCircle,
  ChevronRight,
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
      { href: "/dashboard/audit", label: "Compliance Audit" },
      { href: "/dashboard/reports", label: "Customs Reports" },
      { href: "/dashboard/records", label: "Financial Records" },
      { href: "/dashboard/tools/hscode-lookup", label: "HS Code Lookup" },
    ],
  },
];



export function AppSidebar() {
  const pathname = usePathname();
  const { user: clerkUser } = useUser();
  const userData = useQuery(api.users.current);
  const isAdmin = userData?.role === "admin";

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const declarationCounts = useQuery(api.declarations.getMyDeclarationCounts);
  const reviewCount = declarationCounts?.reviewCount ?? 0;

  return (
    <Sidebar className="!h-screen border-r border-gray-200 bg-gray-50">
      <SidebarHeader className="flex h-[48px] flex-row items-center border-b border-gray-200 px-6">
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

      <SidebarContent className="flex-1 min-h-0 p-4 pt-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-0.5 px-3 text-[10px] font-normal tracking-widest text-gray-400 uppercase">
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

                  return (
                    <Collapsible
                      key={item.label}
                      asChild
                      defaultOpen={isAnyChildActive}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton 
                            tooltip={item.label}
                            className={cn(
                              "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                              isAnyChildActive ? "text-black" : "text-gray-500 hover:bg-gray-100 hover:text-black"
                            )}
                          >
                            <Icon className={cn("h-3.5 w-3.5", isAnyChildActive ? "text-gray-700" : "text-gray-400")} />
                            <span className="flex-1">{item.label}</span>
                            <ChevronRight className="ml-auto h-3 w-3 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="ml-5 border-l border-gray-200 pl-2">
                            {item.items?.map((subItem) => {
                              const isSubActive = pathname === subItem.href || (subItem.href !== "/dashboard" && pathname.startsWith(subItem.href));
                              return (
                                <SidebarMenuSubItem key={subItem.label}>
                                  <SidebarMenuSubButton 
                                    asChild 
                                    isActive={isSubActive}
                                    className={cn(
                                      "px-2 py-1 text-xs font-normal",
                                      isSubActive ? "text-black font-medium" : "text-gray-500 hover:text-black"
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
                          ? "bg-gray-100 text-black"
                          : "text-gray-500 hover:bg-gray-100 hover:text-black",
                      )}
                    >
                      <Link href={(item as any).href} className="flex flex-1 items-center gap-2">
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




      </SidebarContent>

      <SidebarFooter className="mt-auto space-y-3 border-t border-gray-200 bg-white/60 p-4">
        <SidebarMenu className="space-y-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === "/dashboard/support/guide"} className={cn("flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors", pathname === "/dashboard/support/guide" ? "bg-gray-100 text-black" : "text-gray-500 hover:bg-gray-100 hover:text-black")}>
              <Link href="/dashboard/support/guide" className="flex flex-1 items-center gap-2">
                <HelpCircle className={cn("h-3.5 w-3.5", pathname === "/dashboard/support/guide" ? "text-gray-700" : "text-gray-400")} />
                <span className="flex-1">User Guide</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
        {mounted ? (
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
            <UserButton />
            <div className="flex flex-col">
              <span className="max-w-[100px] truncate text-xs font-normal text-gray-700">
                {clerkUser?.fullName || "User"}
              </span>
              <span className="text-[10px] text-gray-400">{isAdmin ? "Admin" : "Enterprise"}</span>
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
