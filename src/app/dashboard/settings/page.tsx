"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser, OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { User, CreditCard, Bell, ExternalLink, Shield, Users, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { planBadgeClass } from "@/lib/stripe-plans";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-gray-500">
          Loading settings…
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const userId = user?.id || "";
  const orgId = organization?.id || "";
  const searchParams = useSearchParams();

  const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : "skip");
  const dbUser = useQuery(api.users.current);
  const orgHmrcMode = useQuery(api.org_hmrc.getModeForOrg, orgId ? { orgId } : "skip");
  const setOrgHmrcMode = useMutation(api.org_hmrc.setOrgMode);
  const [hmrcModeSaving, setHmrcModeSaving] = useState(false);
  const personalMigration = useQuery(api.org_migration.previewPersonalMigration, userId ? {} : "skip");
  const migratePersonal = useMutation(api.org_migration.migratePersonalToActiveOrg);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<
    "profile" | "team" | "subscription" | "security" | "notifications"
  >(
    initialTab === "subscription" ||
      initialTab === "team" ||
      initialTab === "security" ||
      initialTab === "notifications"
      ? initialTab
      : "profile",
  );
  const [stripeLoading, setStripeLoading] = useState(false);
  const checkoutSuccess = searchParams.get("success") === "true";

  async function openBillingPortal() {
    setStripeLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Portal failed");
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setStripeLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "profile" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <User className="h-3.5 w-3.5" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "team" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Team
        </button>
        <button
          onClick={() => setActiveTab("subscription")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "subscription" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <CreditCard className="h-3.5 w-3.5" />
          Subscription
        </button>
        <button
          onClick={() => setActiveTab("security")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "security" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Shield className="h-3.5 w-3.5" />
          Security
        </button>
        <button
          onClick={() => setActiveTab("notifications")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
            activeTab === "notifications" ? "bg-black text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          Notifications
        </button>
        <a
          href="/dashboard/support/changelog"
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors text-gray-600 hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
          Changelog
        </a>
      </div>

      {activeTab === "profile" && (
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
      )}

      {activeTab === "team" && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Users className="h-4 w-4 text-gray-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Team workspace</h3>
              <p className="text-[11px] text-gray-500">
                Create an organization, invite colleagues, and switch workspaces from the sidebar.
              </p>
            </div>
          </div>
          <div className="p-4">
            {personalMigration && personalMigration.totalPending > 0 && !personalMigration.alreadyMigrated && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-950">Move personal data into this organisation</p>
                <p className="mt-1 text-xs text-amber-900/80">
                  You have {personalMigration.totalPending} personal-scoped record
                  {personalMigration.totalPending === 1 ? "" : "s"} (declarations, documents, notifications).
                  Attach them to your active org so your team can see them and Personal workspace can be hidden.
                </p>
                <button
                  type="button"
                  disabled={migrationLoading || !personalMigration.activeOrgId}
                  onClick={async () => {
                    setMigrationLoading(true);
                    setMigrationMessage(null);
                    try {
                      const result = await migratePersonal({});
                      setMigrationMessage(
                        `Migrated ${result.declarations} declarations, ${result.documents} documents, ${result.notifications} notifications.`,
                      );
                    } catch (error) {
                      setMigrationMessage(error instanceof Error ? error.message : "Migration failed");
                    } finally {
                      setMigrationLoading(false);
                    }
                  }}
                  className="mt-3 rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {migrationLoading ? "Migrating…" : "Migrate personal data"}
                </button>
                {!personalMigration.activeOrgId && (
                  <p className="mt-2 text-[11px] text-amber-800">Select your organisation in the header first.</p>
                )}
              </div>
            )}
            {migrationMessage && (
              <div className="mb-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {migrationMessage}
              </div>
            )}
            {personalMigration?.alreadyMigrated && (
              <div className="mb-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Personal data is attached to your organisation. The Personal workspace is hidden in the org switcher.
              </div>
            )}
            <OrganizationProfile
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-0 w-full",
                  navbar: "hidden",
                  pageScrollBox: "p-0",
                },
              }}
            />
          </div>
        </div>
      )}

      {activeTab === "subscription" && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <CreditCard className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-medium text-black">Subscription</h3>
        </div>
        <div className="p-6">
          {checkoutSuccess && (
            <div className="mb-4 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Subscription updated successfully.
            </div>
          )}
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
                      planBadgeClass(String(subscription.plan ?? "")),
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
              <button
                type="button"
                onClick={openBillingPortal}
                disabled={stripeLoading}
                className="flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
              >
                {stripeLoading ? "Opening…" : "Manage subscription"}
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="py-6 text-center">
              <CreditCard className="mx-auto mb-2 h-5 w-5 text-gray-300" />
              <p className="mb-3 text-xs text-gray-500">No active subscription</p>
              <Link
                href="/dashboard/pricing"
                className="inline-flex h-8 items-center rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-gray-800"
              >
                View plans
              </Link>
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === "security" && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <Shield className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-medium text-black">Security</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-black">HMRC connection</p>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Authorise Freightcode to submit declarations on behalf of your Government Gateway account.
                  </p>
                </div>
                <a
                  href="/api/hmrc/auth"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-black px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800"
                >
                  <Link2 className="h-3 w-3" />
                  Connect HMRC
                </a>
              </div>
            </div>

            {orgId && (
              <div className="rounded-lg border border-gray-100 p-4">
                <p className="text-xs font-medium text-black">CDS environment</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Practice uses HMRC sandbox (Trade Test). Live uses production CDS — only enable when your org is approved.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
                      orgHmrcMode?.hmrcMode === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800",
                    )}
                  >
                    {orgHmrcMode?.hmrcMode === "live" ? "Live CDS" : "Practice (sandbox)"}
                  </span>
                  {dbUser?.role === "admin" && (
                    <button
                      type="button"
                      disabled={hmrcModeSaving}
                      onClick={async () => {
                        setHmrcModeSaving(true);
                        try {
                          const next = orgHmrcMode?.hmrcMode === "live" ? "practice" : "live";
                          await setOrgHmrcMode({ orgId, hmrcMode: next });
                        } finally {
                          setHmrcModeSaving(false);
                        }
                      }}
                      className="text-[11px] text-gray-600 underline hover:text-black disabled:opacity-50"
                    >
                      {hmrcModeSaving
                        ? "Saving…"
                        : orgHmrcMode?.hmrcMode === "live"
                          ? "Switch to practice"
                          : "Switch to live"}
                    </button>
                  )}
                </div>
              </div>
            )}

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
          </div>
      </div>
      )}

      {activeTab === "notifications" && (
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
              <span className="text-[0.6875rem] text-gray-600">Declaration Status Updates</span>
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
      )}
    </div>
  );
}
