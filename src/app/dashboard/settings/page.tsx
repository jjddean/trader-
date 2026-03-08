"use client";

import React from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import {
    Settings,
    User,
    CreditCard,
    Shield,
    Bell,
    ExternalLink,
    Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TextScaleToggle } from "@/components/text-scale-toggle";

export default function SettingsPage() {
    const { user } = useUser();
    const userId = user?.id || "";

    const subscription = useQuery(
        api.subscriptions.getSubscription,
        userId ? { userId } : "skip"
    );
    const dbUser = useQuery(api.users.current);

    const planColors: Record<string, string> = {
        Starter: "bg-gray-100 text-gray-700",
        Professional: "bg-blue-100 text-blue-700",
        Enterprise: "bg-purple-100 text-purple-700",
    };

    return (
        <div className="flex h-screen bg-white font-sans text-gray-600 overflow-hidden">
            <DashboardSidebar />

            <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50/50">
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Account & Billing</h1>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-3xl mx-auto space-y-6">

                        {/* Profile */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <User className="h-4 w-4 text-gray-400" />
                                <h3 className="text-sm font-medium text-black">Profile</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Name</label>
                                        <p className="text-xs text-black">{user?.fullName || dbUser?.name || "—"}</p>
                                    </div>
                                    <div>
                                        <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Email</label>
                                        <p className="text-xs text-black">{user?.primaryEmailAddress?.emailAddress || dbUser?.email || "—"}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">User ID</label>
                                    <p className="text-[0.6875rem] text-gray-500 font-mono">{userId || "—"}</p>
                                </div>
                            </div>
                        </div>

                        {/* Subscription */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <CreditCard className="h-4 w-4 text-gray-400" />
                                <h3 className="text-sm font-medium text-black">Subscription</h3>
                            </div>
                            <div className="p-6">
                                {subscription ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Plan</label>
                                                <span className={cn(
                                                    "text-[0.625rem] font-medium px-2 py-1 rounded-md",
                                                    planColors[subscription.plan] || "bg-gray-100 text-gray-700"
                                                )}>
                                                    {subscription.plan}
                                                </span>
                                            </div>
                                            <div>
                                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Status</label>
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full",
                                                        subscription.status === "active" ? "bg-green-500" :
                                                            subscription.status === "trialing" ? "bg-blue-500" : "bg-orange-500"
                                                    )} />
                                                    <span className="text-xs text-gray-700 capitalize">{subscription.status}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[0.625rem] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Renews</label>
                                                <p className="text-xs text-gray-700">
                                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
                                                        day: "numeric", month: "short", year: "numeric"
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                        <button className="h-8 px-3 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors flex items-center gap-1.5">
                                            Manage Subscription
                                            <ExternalLink className="h-3 w-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <CreditCard className="h-5 w-5 text-gray-300 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500 mb-3">No active subscription</p>
                                        <button className="h-8 px-4 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors">
                                            View Plans
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Display */}
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                <Monitor className="h-4 w-4 text-gray-400" />
                                <h3 className="text-sm font-medium text-black">Display</h3>
                            </div>
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-700 font-medium">Text Size</p>
                                        <p className="text-[0.625rem] text-gray-400 mt-0.5">Adjust text size across the entire application</p>
                                    </div>
                                    <TextScaleToggle />
                                </div>
                            </div>
                        </div>

                        {/* Security & Notifications */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                    <Shield className="h-4 w-4 text-gray-400" />
                                    <h3 className="text-sm font-medium text-black">Security</h3>
                                </div>
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">Two-Factor Auth</span>
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">Enabled</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">API Keys</span>
                                        <button className="text-[0.625rem] text-gray-400 hover:text-black transition-colors">Manage</button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">HMRC OAuth</span>
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">Not Connected</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                                    <Bell className="h-4 w-4 text-gray-400" />
                                    <h3 className="text-sm font-medium text-black">Notifications</h3>
                                </div>
                                <div className="p-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">Compliance Alerts</span>
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">On</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">New Prospects</span>
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-green-100 text-green-700">On</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[0.6875rem] text-gray-600">Policy Updates</span>
                                        <span className="text-[0.625rem] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">Off</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
