"use client"
import * as React from "react"
import Link from "next/link"
import {
    IconCamera,
    IconChartBar,
    IconCreditCard,
    IconDashboard,
    IconDatabase,
    IconFileAi,
    IconFileDescription,
    IconFileWord,
    IconFolder,
    IconHelp,
    IconInnerShadowTop,
    IconListDetails,
    IconReport,
    IconRosetteFilled,
    IconSearch,
    IconSettings,
    IconUsers,
} from "@tabler/icons-react"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
    user: {
        name: "TradeDNA User",
        email: "user@tradedna.com",
        avatar: "/avatars/user.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: IconDashboard,
            isActive: true,
        },
        {
            title: "Discovery",
            url: "/dashboard/search",
            icon: IconSearch,
        },
        {
            title: "Prospects",
            url: "/dashboard/prospects",
            icon: IconUsers,
        },
        {
            title: "Intelligence",
            url: "/dashboard/assistant",
            icon: IconFileAi,
        },
        {
            title: "Calculators",
            url: "/dashboard/calculator",
            icon: IconChartBar,
        },
        {
            title: "Pricing",
            url: "/dashboard/pricing",
            icon: IconRosetteFilled,
        },
        {
            title: "Compliance",
            url: "/dashboard/compliance",
            icon: IconListDetails,
        },
    ],
    navSecondary: [
        {
            title: "Billing",
            url: "/dashboard/user/billing",
            icon: IconCreditCard,
        },
        {
            title: "Settings",
            url: "/dashboard/user",
            icon: IconSettings,
        },
        {
            title: "Get Help",
            url: "#",
            icon: IconHelp,
        },
    ],
    documents: [
        {
            name: "Strategy Documents",
            url: "#",
            icon: IconFileDescription,
        },
        {
            name: "Trade Reports",
            url: "#",
            icon: IconReport,
        },
    ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            size="lg"
                            className="data-[slot=sidebar-menu-button]:p-1.5!"
                        >
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <IconInnerShadowTop className="size-5!" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">TradeDNA AI</span>
                                    <span className="truncate text-xs">Intelligence Platform</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                <NavDocuments items={data.documents} />
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user} />
            </SidebarFooter>
        </Sidebar>
    )
}
