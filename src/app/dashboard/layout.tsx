"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { UserSync } from "@/components/auth/user-sync";
import { OrgWorkspaceGate } from "@/components/auth/org-workspace-gate";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AdminSidebar } from "@/components/admin-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { HmrcConnectBanner } from "@/components/hmrc-connect-banner";
import { PracticeModeBanner } from "@/components/practice-mode-banner";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  getRememberedDeclarationLane,
  rememberDeclarationLane,
} from "@/lib/declaration-lane-cache";
import { preloadHsCodeRows } from "@/lib/hs-codes-static-cache";

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
    "/dashboard/settings": { title: "Account Settings", badge: "PREFERENCES", badgeVariant: "default" },
    "/dashboard/declarations": { title: "Declarations", badge: "CDS", badgeVariant: "default" },
    "/dashboard/documents": { title: "Documents", badge: "DOCS", badgeVariant: "success" },
    "/dashboard/reports": { title: "Customs Audit Reports", badge: "REPORTS", badgeVariant: "default" },
    "/dashboard/records": { title: "Financial Records", badge: "LEDGER", badgeVariant: "default" },
    "/dashboard/pricing": { title: "Plans", badge: "STRIPE", badgeVariant: "success" },
    "/dashboard/tools/hscode-lookup": { title: "HS Code Lookup", badge: "TOOLS", badgeVariant: "default" },
    "/dashboard/tre-import": { title: "Import TRE Data", badge: "TRE", badgeVariant: "default" },
    "/dashboard/audit": { title: "Compliance Audit", badge: "AUDIT", badgeVariant: "default" },
    "/dashboard/trade-compliance": { title: "Trade Compliance", badge: "COMPLIANCE", badgeVariant: "default" },
    "/dashboard/admin": { title: "Admin Overview", badge: "ADMIN", badgeVariant: "blue" },
    "/dashboard/admin/subscriptions": { title: "Vendor Stack", badge: "ADMIN", badgeVariant: "blue" },
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
  if (declaration !== undefined && declarationId) {
    rememberDeclarationLane(declarationId, declaration);
  }
  const resolvedDeclaration =
    declaration ?? getRememberedDeclarationLane(declarationId ?? undefined);

  let config = routeConfigs[pathname] || { title: "FreightCode", badge: "BETA" };
  
  // Override title for declaration workspaces
  if (declarationId && resolvedDeclaration) {
    const declarationTitle = resolvedDeclaration.mrn && String(resolvedDeclaration.mrn).trim().length > 0 ? resolvedDeclaration.mrn : "Draft CDS Entry";
    config = { 
        title: declarationTitle, 
        badge: "WORKSPACE", 
        badgeVariant: "blue" 
    };
  } else if (declarationId && !resolvedDeclaration) {
    config = { title: "Declaration Workspace", badge: "LOADING" };
  }

  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void preloadHsCodeRows();
  }, []);

  useEffect(() => {
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <OrgWorkspaceGate>
    <SidebarProvider defaultOpen={true}>
      {pathname.startsWith("/dashboard/admin") ? <AdminSidebar /> : <AppSidebar />}
      <UserSync />
      <SidebarInset className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
        <DashboardHeader
          title={config.title}
          badge={config.badge}
          badgeVariant={config.badgeVariant}
        />
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <Suspense fallback={null}>
            {pathname === "/dashboard" && <PracticeModeBanner />}
            <HmrcConnectBanner />
          </Suspense>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
    </OrgWorkspaceGate>
  );
}
