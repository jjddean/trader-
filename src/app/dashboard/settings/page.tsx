"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { User, CreditCard, Bell, ExternalLink, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useUser();
  const userId = user?.id || "";

  const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : "skip");
  const dbUser = useQuery(api.users.current);
  const hmrcToken = useQuery(api.hmrc.getToken, userId ? { userId } : "skip");

  const planColors: Record<string, string> = {
    Starter: "bg-gray-100 text-gray-700",
    Professional: "bg-blue-100 text-blue-700",
    Enterprise: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Profile */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <User className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Profile</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Name
              </label>
              <p className="text-xs text-black">{user?.fullName || dbUser?.name || "—"}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                Email
              </label>
              <p className="text-xs text-black">
                {user?.primaryEmailAddress?.emailAddress || dbUser?.email || "—"}
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
              User ID
            </label>
            <p className="font-mono text-[0.6875rem] text-gray-500">{userId || "—"}</p>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Subscription</h3>
        </div>
        <div className="p-6">
          {subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Plan
                  </label>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[0.625rem] font-medium",
                      planColors[subscription.plan] || "bg-gray-100 text-gray-700",
                    )}
                  >
                    {subscription.plan}
                  </span>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Status
                  </label>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        subscription.status === "active"
                          ? "bg-green-500"
                          : subscription.status === "trialing"
                            ? "bg-blue-500"
                            : "bg-orange-500",
                      )}
                    />
                    <span className="text-xs text-gray-700 capitalize">{subscription.status}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-gray-400 uppercase">
                    Renews
                  </label>
                  <p className="text-xs text-gray-700">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <button className="flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-gray-800">
                Manage Subscription
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <CreditCard className="mx-auto mb-2 h-5 w-5 text-gray-300" />
              <p className="mb-3 text-xs text-gray-500">No active subscription</p>
              <button className="h-8 rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800">
                View Plans
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Security & Notifications */}
      <div className="grid grid-cols-2 gap-6">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Shield className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Security</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">Two-Factor Auth</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                Enabled
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">API Keys</span>
              <button className="text-[0.625rem] text-gray-400 transition-colors hover:text-black">
                Manage
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">HMRC OAuth</span>
              {hmrcToken !== undefined ? (
                hmrcToken ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                      Connected
                    </span>
                    <a
                      href="/api/hmrc/auth"
                      className="text-[0.625rem] text-gray-400 transition-colors hover:text-black underline"
                    >
                      Reconnect
                    </a>
                  </div>
                ) : (
                  <a
                    href="/api/hmrc/auth"
                    className="rounded bg-black px-2 py-1 text-[0.625rem] font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    Connect HMRC
                  </a>
                )
              ) : (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-400">
                  Loading...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Bell className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Notifications</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">Compliance Alerts</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                On
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">New Prospects</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                On
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-gray-600">Policy Updates</span>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-[0.625rem] font-medium text-gray-600">
                Off
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
