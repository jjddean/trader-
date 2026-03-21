"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { UserSync } from "@/components/auth/user-sync";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

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
  "/dashboard/declarations": { title: "Declarations", badge: "CDS", badgeVariant: "default" },
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
  
  // Extract declaration ID if in a declaration workspace
  const declarationIdMatch = pathname.match(/\/dashboard\/declarations\/([^\/]+)/);
  const declarationId = declarationIdMatch ? declarationIdMatch[1] : null;
  
  // Fetch declaration data to get the name
  const declaration = useQuery(
    api.declarations.getLane,
    declarationId ? { id: declarationId as Id<"declarations"> } : "skip",
  );

  let config = routeConfigs[pathname] || { title: "FreightCode", badge: "BETA" };
  
  // Override title for declaration workspaces
  if (declarationId && declaration) {
    const declarationTitle = declaration.mrn && String(declaration.mrn).trim().length > 0 ? declaration.mrn : "Draft CDS Entry";
    config = { 
        title: declarationTitle, 
        badge: "WORKSPACE", 
        badgeVariant: "blue" 
    };
  } else if (declarationId && !declaration) {
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
