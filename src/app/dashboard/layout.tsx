"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { UserSync } from "@/components/auth/user-sync";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const routeConfigs: Record<
  string,
  { title: string; badge: string; badgeVariant?: "default" | "success" | "blue" }
> = {
  "/dashboard": { title: "Customs Dashboard", badge: "LIVE", badgeVariant: "default" },
  "/dashboard/prospects": { title: "Partner Prospects", badge: "PIPELINE", badgeVariant: "blue" },
  "/dashboard/calculator": {
    title: "Landed Cost Calculator",
    badge: "TARIFFS",
    badgeVariant: "default",
  },
  "/dashboard/assistant": { title: "FreightCode Assistant", badge: "AI", badgeVariant: "success" },
  "/dashboard/inbox": { title: "Inbox", badge: "HUB", badgeVariant: "default" },
  "/dashboard/settings": {
    title: "Account Settings",
    badge: "PREFERENCES",
    badgeVariant: "default",
  },
  "/dashboard/lanes": { title: "Declarations", badge: "CDS", badgeVariant: "default" },
  "/dashboard/documents": { title: "Smart Upload", badge: "DOCS", badgeVariant: "success" },
  "/dashboard/reports": { title: "Customs Audit Reports", badge: "REPORTS", badgeVariant: "default" },
  "/dashboard/records": { title: "Financial Records", badge: "LEDGER", badgeVariant: "default" },
  "/dashboard/user": { title: "Account", badge: "PROFILE", badgeVariant: "default" },
  "/dashboard/user/billing": { title: "Billing", badge: "STRIPE", badgeVariant: "success" },
  "/dashboard/admin": { title: "Admin", badge: "INTERNAL", badgeVariant: "default" },
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Extract lane ID if in a lane workspace
  const laneIdMatch = pathname.match(/\/dashboard\/lanes\/([^\/]+)/);
  const laneId = laneIdMatch ? laneIdMatch[1] : null;
  
  // Fetch lane data to get the name
  const lane = useQuery(api.trade_lanes.getLane, laneId ? { id: laneId as any } : "skip");

  let config = routeConfigs[pathname] || { title: "FreightCode", badge: "BETA" };
  
  // Override title for lane workspaces
  if (laneId && lane) {
    config = { 
        title: lane.description || "Declaration Workspace", 
        badge: "WORKSPACE", 
        badgeVariant: "blue" 
    };
  } else if (laneId && !lane) {
    config = { title: "Declaration Workspace", badge: "LOADING" };
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <UserSync />
      <SidebarInset className="flex min-h-screen flex-col overflow-hidden bg-gray-50">
        {pathname !== "/dashboard/inbox" && (
          <DashboardHeader
            title={config.title}
            badge={config.badge}
            badgeVariant={config.badgeVariant}
          />
        )}
        <main
          className={cn(
            "flex-1 overflow-y-auto [scrollbar-gutter:stable]",
            pathname === "/dashboard/inbox" && "overflow-hidden",
          )}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
