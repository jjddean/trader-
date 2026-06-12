"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { UserSync } from "@/components/auth/user-sync";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  
  const hmrcEnv = process.env.NEXT_PUBLIC_HMRC_ENV || "sandbox";
  const dashboardBadge =
    hmrcEnv === "production" ? "LIVE" : hmrcEnv === "tdr" ? "TDR" : "SANDBOX";
  const dashboardBadgeVariant = "default";

  const routeConfigs: Record<
    string,
    { title: string; badge: string; badgeVariant?: "default" | "success" | "blue" }
  > = {
    "/dashboard": { title: "Customs Dashboard", badge: dashboardBadge, badgeVariant: (dashboardBadgeVariant as "default") },
    "/dashboard/prospects": { title: "Partner Prospects", badge: "PIPELINE", badgeVariant: "blue" },
    "/dashboard/calculator": { title: "Landed Cost Calculator", badge: "TARIFFS", badgeVariant: "default" },
    "/dashboard/assistant": { title: "FreightCode Assistant", badge: "AI", badgeVariant: "success" },
    "/dashboard/inbox": { title: "Inbox", badge: "HUB", badgeVariant: "default" },
    "/dashboard/settings": { title: "Account Settings", badge: "PREFERENCES", badgeVariant: "default" },
    "/dashboard/declarations": { title: "Declarations", badge: "CDS", badgeVariant: "default" },
    "/dashboard/documents": { title: "Documents", badge: "DOCS", badgeVariant: "success" },
    "/dashboard/reports": { title: "Customs Audit Reports", badge: "REPORTS", badgeVariant: "default" },
    "/dashboard/records": { title: "Financial Records", badge: "LEDGER", badgeVariant: "default" },
    "/dashboard/user": { title: "Account", badge: "PROFILE", badgeVariant: "default" },
    "/dashboard/user/billing": { title: "Billing", badge: "STRIPE", badgeVariant: "success" },
    "/dashboard/tools/hscode-lookup": { title: "HS Code Lookup", badge: "TOOLS", badgeVariant: "default" },
    "/dashboard/admin/subscriptions": { title: "Subscriptions Hub", badge: "ADMIN", badgeVariant: "blue" },
  };

  // Extract declaration ID if in a declaration workspace
  const declarationIdMatch = pathname.match(/\/dashboard\/declarations\/([^\/]+)/);
  const declarationId = declarationIdMatch ? declarationIdMatch[1] : null;
  
  // Fetch declaration data to get the name
  const declaration = useQuery(
    api.declarations.getLane,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && declarationId
      ? { id: declarationId as Id<"declarations"> }
      : "skip",
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
      {pathname.startsWith("/dashboard/admin") ? <AdminSidebar /> : <AppSidebar />}
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
