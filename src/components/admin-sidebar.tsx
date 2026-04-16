"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Bot, CreditCard, History, ChevronLeft } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
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

const adminNavItems = [
  { href: "/dashboard/admin/setup", label: "Set Up", icon: Settings },
  { href: "/dashboard/admin/clerk", label: "Online Clerk", icon: Bot },
  { href: "/dashboard/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/dashboard/admin/audit", label: "System Audit", icon: History },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user: clerkUser } = useUser();

  return (
    <Sidebar className="border-r border-gray-200 bg-gray-50 !h-screen">
      <SidebarHeader className="flex h-[48px] flex-row items-center border-b border-gray-200 px-6">
        <Link
          href="/"
          className="flex w-full items-center gap-2 text-black transition-opacity hover:opacity-80"
        >
          <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
            <span className="text-lg font-bold tracking-tight">freight</span>
            <span className="text-lg font-bold tracking-tight text-slate-500">code</span>
            <span className="font-normal text-[11px] -translate-y-[4px] ml-[-1px] text-slate-500">®</span>
            <span className="ml-1.5 text-[10px] font-semibold text-red-500">admin</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="flex flex-col p-4 pt-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-0.5 px-3 text-[10px] font-normal tracking-widest text-gray-400 uppercase">
            Admin Panel
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href);
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
                        <Icon className={cn("h-3.5 w-3.5", isActive ? "text-gray-700" : "text-gray-400")} />
                        <span className="flex-1">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0 mt-4">
          <SidebarGroupLabel className="mb-0.5 px-3 text-[10px] font-normal tracking-widest text-gray-400 uppercase">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal text-gray-500 transition-colors hover:bg-gray-100 hover:text-black"
                >
                  <Link href="/dashboard" className="flex flex-1 items-center gap-2">
                    <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
                    <span className="flex-1">Back to Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="space-y-3 p-4">
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 border border-red-100">
          <UserButton />
          <div className="flex flex-col">
            <span className="max-w-[100px] truncate text-xs font-normal text-gray-700">
              {clerkUser?.fullName || "Admin"}
            </span>
            <span className="text-[10px] text-red-500">Administrator</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
