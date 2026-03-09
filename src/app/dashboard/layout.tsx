"use client";

import { usePathname } from "next/navigation";
import { UserSync } from "@/components/auth/user-sync";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";

const routeConfigs: Record<string, { title: string; badge: string; badgeVariant?: "default" | "success" | "blue" }> = {
    "/dashboard": { title: "Trade Intelligence Overview", badge: "LIVE", badgeVariant: "default" },
    "/dashboard/compliance": { title: "DCTS Compliance Engine", badge: "AUDIT & DOCS", badgeVariant: "success" },
    "/dashboard/prospects": { title: "Partner Prospects", badge: "PIPELINE", badgeVariant: "blue" },
    "/dashboard/calculator": { title: "Landed Cost Calculator", badge: "TARIFFS", badgeVariant: "default" },
    "/dashboard/assistant": { title: "TradeDNA Assistant", badge: "AI", badgeVariant: "success" },
    "/dashboard/inbox": { title: "Message Center", badge: "NOTIFICATIONS", badgeVariant: "default" },
    "/dashboard/settings": { title: "Account Settings", badge: "PREFERENCES", badgeVariant: "default" },
};

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const pathname = usePathname();
    const config = routeConfigs[pathname] || { title: "TradeDNA Pro", badge: "BETA" };

    return (
        <SidebarProvider defaultOpen={true}>
            <AppSidebar />
            <UserSync />
            <SidebarInset className="bg-gray-50/50 flex flex-col min-h-screen overflow-hidden">
                <DashboardHeader
                    title={config.title}
                    badge={config.badge}
                    badgeVariant={config.badgeVariant}
                />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

