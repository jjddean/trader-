"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessageSquare,
  PoundSterling,
  ShieldCheck,
} from "lucide-react";
import { SidebarUserButton } from "@/components/auth/sidebar-user-button";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/portal/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/portal/declarations", label: "Declarations", icon: FileText },
  { href: "/portal/documents", label: "Documents", icon: FolderOpen },
  { href: "/portal/charges", label: "Charges", icon: PoundSterling },
  { href: "/portal/compliance", label: "Export controls", icon: ShieldCheck },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
  { href: "/portal/company", label: "Company", icon: Building2 },
] as const;

function isNavActive(pathname: string, href: string) {
  if (href === "/portal/dashboard") {
    return pathname === "/portal" || pathname === "/portal/dashboard";
  }
  if (href === "/portal/declarations") {
    return (
      pathname === "/portal/declarations" || pathname.startsWith("/portal/declarations/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface PortalSidebarProps {
  clientName: string;
}

/** Client-portal sidebar — not the broker AppSidebar. */
export function PortalSidebar({ clientName }: PortalSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar className="!h-screen border-r border-slate-200 bg-white [&_[data-sidebar=sidebar]]:bg-white">
      <SidebarHeader className="flex h-[55px] shrink-0 flex-row items-center border-b border-slate-200 px-6">
        <Link
          href="/portal/dashboard"
          className="flex w-full items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div className="flex items-baseline whitespace-nowrap text-[#020817] leading-none">
            <span className="text-lg font-bold tracking-tight">freight</span>
            <span className="text-lg font-bold tracking-tight text-slate-500">code</span>
            <span className="ml-[-1px] -translate-y-[4px] text-[11px] font-normal text-slate-500">
              ®
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-3 pb-1 pt-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-0 px-2 text-[10px] font-normal tracking-widest text-slate-400 uppercase">
            Client portal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isNavActive(pathname, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={cn(
                        "flex h-auto w-full items-center gap-2 rounded-md px-3 py-1 text-xs font-normal transition-colors",
                        active
                          ? "bg-slate-100 text-black"
                          : "text-slate-500 hover:bg-slate-100 hover:text-black",
                      )}
                    >
                      <Link href={href} className="flex flex-1 items-center gap-2">
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            active ? "text-slate-700" : "text-slate-400",
                          )}
                        />
                        <span className="flex-1">{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto shrink-0 space-y-1.5 bg-white p-2">
        <div className="flex min-h-[42px] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
          <SidebarUserButton />
          <div className="flex min-w-0 flex-col">
            <span className="max-w-[120px] truncate text-xs font-normal text-slate-700">
              {clientName}
            </span>
            <span className="max-w-[120px] truncate text-[10px] text-slate-400">
              Read-only access
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
