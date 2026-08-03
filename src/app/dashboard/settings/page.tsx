"use client";

import React, { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUser, useOrganization, useClerk } from "@clerk/nextjs";
import { User, CreditCard, Bell, ExternalLink, Shield, Users, Link2, Unlink, Download, Lock, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { planBadgeClass } from "@/lib/stripe-plans";
import { isSyntheticStripeCustomerId } from "@/lib/stripe-customer";
import { PracticeSandboxTestUser } from "@/components/practice-sandbox-test-user";
import { compactProfileModalAppearance } from "@/lib/clerk-compact";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-slate-500">
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
  const clerk = useClerk();
  const { isAuthenticated } = useConvexAuth();
  const userId = user?.id || "";
  const orgId = organization?.id || "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const subscription = useQuery(api.subscriptions.getSubscription, userId ? { userId } : "skip");
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const orgHmrcMode = useQuery(api.org_hmrc.getModeForOrg, orgId ? { orgId } : "skip");
  const setMyOrgHmrcMode = useMutation(api.org_hmrc.setMyOrgMode);
  const hmrcConnection = useQuery(api.hmrc.getToken, userId ? { userId } : "skip");
  // Prefetch so Security tab does not pop-in when selected
  useQuery(
    api.org_hmrc.getSandboxTestUserForOrg,
    orgId && orgHmrcMode?.hmrcMode !== "live" ? { orgId } : "skip",
  );
  const disconnectHmrc = useMutation(api.hmrc.disconnectToken);
  const [hmrcDisconnecting, setHmrcDisconnecting] = useState(false);
  const [hmrcModeSaving, setHmrcModeSaving] = useState(false);
  const [hmrcModeError, setHmrcModeError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const personalMigration = useQuery(api.org_migration.previewPersonalMigration, userId ? {} : "skip");
  const migratePersonal = useMutation(api.org_migration.migratePersonalToActiveOrg);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null);
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<
    "profile" | "team" | "subscription" | "security" | "notifications" | "privacy"
  >(
    initialTab === "subscription" ||
      initialTab === "team" ||
      initialTab === "security" ||
      initialTab === "notifications" ||
      initialTab === "privacy"
      ? initialTab
      : "profile",
  );
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const checkoutSuccess = searchParams.get("success") === "true";
  const [renderedAt] = useState(() => Date.now());
  const hmrcConnectionActive = Boolean(hmrcConnection && hmrcConnection.expiresAt > renderedAt);
  const stripeCustomerId =
    typeof subscription?.stripeCustomerId === "string" ? subscription.stripeCustomerId : "";
  const canManageBilling =
    Boolean(stripeCustomerId) && !isSyntheticStripeCustomerId(stripeCustomerId);

  const setSettingsTab = useCallback(
    (id: typeof activeTab) => {
      setActiveTab(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id === "profile") {
        params.delete("tab");
      } else {
        params.set("tab", id);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  async function openBillingPortal() {
    setStripeLoading(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setStripeError(body.error || "Could not open billing portal.");
        return;
      }
      if (body.url) window.location.href = body.url;
    } catch {
      setStripeError("Could not open billing portal.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleExportData() {
    setExportLoading(true);
    setExportError(null);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] || `freightcode-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportLoading(false);
    }
  }

  const settingsTabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "team" as const, label: "Team", icon: Users },
    { id: "subscription" as const, label: "Subscription", icon: CreditCard },
    { id: "security" as const, label: "Security", icon: Shield },
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "privacy" as const, label: "Privacy", icon: Lock },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-2">
        {settingsTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSettingsTab(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors",
              activeTab === id ? "bg-black text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-[36rem]">
      {activeTab === "profile" && (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <User className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-medium text-black">Profile</h3>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                Name
              </label>
              <p className="text-xs text-black">{user?.fullName || dbUser?.name || "—"}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                Email
              </label>
              <p className="text-xs text-black">
                {user?.primaryEmailAddress?.emailAddress || dbUser?.email || "—"}
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
              User ID
            </label>
            <p className="font-mono text-[0.6875rem] text-slate-500">{userId || "—"}</p>
          </div>
        </div>
      </div>
      )}

      {activeTab === "team" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Users className="h-4 w-4 text-slate-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Organisation</h3>
              <p className="text-[11px] text-slate-500">
                Switch workspace from the header menu. Members, invites, and org name open in the same
                panel as <span className="font-medium">Manage organisation</span> on that menu.
              </p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            {organization ? (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">{organization.name}</p>
                    <p className="text-[11px] text-slate-500">Active workspace</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    clerk.openOrganizationProfile({ appearance: compactProfileModalAppearance })
                  }
                  className="shrink-0 rounded-md bg-black px-3 py-1.5 text-[11px] font-medium text-white hover:bg-slate-800"
                >
                  Manage organisation
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-600">
                Select or create an organisation from the workspace menu in the header to invite team
                members.
              </p>
            )}
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
                  className="mt-3 rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
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
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Personal data is attached to your organisation. The Personal workspace is hidden in the org switcher.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "subscription" && (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <CreditCard className="h-4 w-4 text-slate-400" />
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
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
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
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
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
                    <span className="text-xs text-slate-700 capitalize">{subscription.status}</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[0.625rem] font-semibold tracking-widest text-slate-400 uppercase">
                    Renews
                  </label>
                  <p className="text-xs text-slate-700">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              {stripeError && (
                <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {stripeError}
                </div>
              )}
              {canManageBilling ? (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={stripeLoading}
                  className="flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                >
                  {stripeLoading ? "Opening…" : "Manage subscription"}
                  <ExternalLink className="h-3 w-3" />
                </button>
              ) : (
                <Link
                  href="/dashboard/pricing"
                  className="inline-flex h-8 items-center rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-slate-800"
                >
                  View plans
                </Link>
              )}
            </div>
          ) : (
            <div className="py-6 text-center">
              <CreditCard className="mx-auto mb-2 h-5 w-5 text-slate-300" />
              <p className="mb-3 text-xs text-slate-500">No active subscription</p>
              <Link
                href="/dashboard/pricing"
                className="inline-flex h-8 items-center rounded-md bg-black px-4 text-xs font-normal text-white transition-colors hover:bg-slate-800"
              >
                View plans
              </Link>
            </div>
          )}
        </div>
      </div>
      )}

      {activeTab === "security" && (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Shield className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-medium text-black">Security</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-black">HMRC connection</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {orgHmrcMode?.hmrcMode === "live" ? (
                        <>
                          Authorise Freightcode with your live Government Gateway account. Submissions
                          have legal effect at the border.
                        </>
                      ) : (
                        <>
                          Authorise Freightcode for HMRC&apos;s test environment (TDR). Use the Test User
                          credentials below at sign-in — not your live Government Gateway.
                        </>
                      )}
                    </p>
                  </div>
                  {orgHmrcMode?.hmrcMode !== "live" && (
                    <PracticeSandboxTestUser compact enabled={activeTab === "security"} />
                  )}
                  {hmrcConnection && (
                    <p
                      className={cn(
                        "text-[11px]",
                        hmrcConnectionActive ? "text-green-700" : "text-amber-700",
                      )}
                    >
                      {hmrcConnectionActive ? "Connected" : "Session expired"} · token
                      expires{" "}
                      {new Date(hmrcConnection.expiresAt).toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {hmrcConnection.eori ? ` · EORI ${hmrcConnection.eori}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {hmrcConnection ? (
                    <button
                      type="button"
                      disabled={hmrcDisconnecting}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            "Remove your stored HMRC OAuth tokens from Freightcode? Existing declarations and notifications are not affected.",
                          )
                        ) {
                          return;
                        }
                        setHmrcDisconnecting(true);
                        try {
                          await disconnectHmrc({});
                        } finally {
                          setHmrcDisconnecting(false);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      <Unlink className="h-3 w-3" />
                      {hmrcDisconnecting ? "Disconnecting…" : "Disconnect HMRC"}
                    </button>
                  ) : null}
                  <a
                    href="/api/hmrc/auth"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium",
                      hmrcConnectionActive
                        ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        : "bg-black text-white hover:bg-slate-800",
                    )}
                  >
                    <Link2 className="h-3 w-3" />
                    {hmrcConnection ? "Reconnect HMRC" : "Connect HMRC"}
                  </a>
                </div>
              </div>
            </div>

            {orgId && (
              <div className="rounded-lg border border-slate-100 p-4">
                <p className="text-xs font-medium text-black">CDS environment</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {orgHmrcMode?.hmrcMode === "live"
                    ? "Your organisation is on live CDS. Submissions have legal effect."
                    : "Your organisation is in the test environment (HMRC sandbox / TDR). Submissions are not legally binding."}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide",
                      orgHmrcMode?.hmrcMode === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800",
                    )}
                  >
                    {orgHmrcMode?.hmrcMode === "live" ? "Live CDS" : "Test environment"}
                  </span>
                  <button
                    type="button"
                    disabled={hmrcModeSaving || !orgHmrcMode}
                    onClick={async () => {
                      const next = orgHmrcMode?.hmrcMode === "live" ? "practice" : "live";
                      if (!window.confirm(`Switch this organisation to ${next === "live" ? "live CDS" : "the test environment"}?`)) return;
                      setHmrcModeSaving(true);
                      setHmrcModeError(null);
                      try {
                        await setMyOrgHmrcMode({ orgId, hmrcMode: next });
                      } catch (error) {
                        setHmrcModeError(error instanceof Error ? error.message : "Could not change CDS environment.");
                      } finally {
                        setHmrcModeSaving(false);
                      }
                    }}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hmrcModeSaving ? "Switching…" : orgHmrcMode?.hmrcMode === "live" ? "Switch to sandbox" : "Switch to live"}
                  </button>
                </div>
                {hmrcModeError && <p className="mt-2 text-[11px] text-red-600">{hmrcModeError}</p>}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-slate-600">Two-Factor Auth</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                Enabled
              </span>
            </div>
          </div>
      </div>
      )}

      {activeTab === "notifications" && (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Bell className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-medium text-black">Notifications</h3>
          </div>
          <div className="space-y-3 p-6">
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-slate-600">Compliance Alerts</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                On
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-slate-600">Declaration Status Updates</span>
              <span className="rounded bg-green-100 px-2 py-0.5 text-[0.625rem] font-medium text-green-700">
                On
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[0.6875rem] text-slate-600">Policy Updates</span>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[0.625rem] font-medium text-slate-600">
                Off
              </span>
            </div>
          </div>
      </div>
      )}

      {activeTab === "privacy" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
            <Lock className="h-4 w-4 text-slate-400" />
            <div>
              <h3 className="text-sm font-medium text-black">Data &amp; privacy</h3>
              <p className="text-[11px] text-slate-500">
                Download a copy of your account data (declarations, items, documents metadata,
                notifications, audit log).
              </p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <p className="text-xs text-slate-600">
              The export reflects your <strong>active organisation</strong> in the header, or personal
              workspace if none is selected. OAuth tokens are not included. To delete your account,
              contact{" "}
              <a href="mailto:info@freightcode.co.uk" className="text-blue-600 underline hover:text-blue-800">
                info@freightcode.co.uk
              </a>
              .
            </p>
            {exportError && (
              <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                {exportError}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleExportData()}
                disabled={exportLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-normal text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                <Download className="h-3 w-3" />
                {exportLoading ? "Preparing export…" : "Export my data"}
              </button>
              <Link href="/privacy" className="text-xs text-slate-500 underline hover:text-black">
                Privacy policy
              </Link>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
