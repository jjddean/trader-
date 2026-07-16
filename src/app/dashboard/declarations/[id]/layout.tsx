"use client";

import React from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  getRememberedDeclarationLane,
  rememberDeclarationLane,
} from "@/lib/declaration-lane-cache";
import { DeclarationWorkspaceLoader } from "@/components/declaration-session-states";
import { FileText, ListChecks, UploadCloud, Activity, Send, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  badgeIconForTone,
  badgeToneClassName,
  declarationHumanSubtitle,
  mrnSubtitleClass,
  resolveDeclarationRowBadge,
} from "@/lib/declaration-status-display";
import { PreClearanceEstimate } from "@/components/pre-clearance-estimate";

export default function DeclarationWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const declarationId = params?.id as Id<"declarations">;
  const authReady =
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated;
  const declaration = useQuery(
    api.declarations.getLane,
    authReady && declarationId ? { id: declarationId } : "skip",
  );
  if (declaration !== undefined && declarationId) {
    rememberDeclarationLane(String(declarationId), declaration);
  }
  const resolvedDeclaration =
    declaration ?? getRememberedDeclarationLane(declarationId ? String(declarationId) : undefined);
  const financialEstimate = useQuery(
    api.declarations.getDeclarationFinancialEstimate,
    authReady && declarationId ? { declarationId } : "skip",
  );
  const orgHmrc = useQuery(
    api.org_hmrc.getModeForDeclaration,
    authReady && declarationId ? { declarationId } : "skip",
  );
  const estimateReady = financialEstimate !== undefined;

  const isAuthLoading = !isLoaded || isConvexAuthLoading;
  const isSessionLoading =
    authReady &&
    declaration === undefined &&
    getRememberedDeclarationLane(declarationId ? String(declarationId) : undefined) === undefined;
  const isSignedOut = isLoaded && !isConvexAuthLoading && !isSignedIn;
  const isConvexMissing = isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated;
  const isNotFound = authReady && declaration === null;
  const hasDeclaration = authReady && Boolean(resolvedDeclaration);
  const showWorkspaceChrome = hasDeclaration && !isNotFound;

  const steps = [
    { id: "overview", name: "1. Core Schema", icon: FileText, path: `/dashboard/declarations/${declarationId}` },
    { id: "items", name: "2. Goods Items", icon: ListChecks, path: `/dashboard/declarations/${declarationId}/items` },
    { id: "submit", name: "3. Submission", icon: Send, path: `/dashboard/declarations/${declarationId}/submit` },
    { id: "status", name: "4. HMRC Status", icon: Activity, path: `/dashboard/declarations/${declarationId}/status` },
    { id: "documents", name: "5. Secure Upload", icon: UploadCloud, path: `/dashboard/declarations/${declarationId}/documents`, disabled: !resolvedDeclaration?.mrn },
  ];

  const declarationTitle =
    hasDeclaration && resolvedDeclaration!.mrn && String(resolvedDeclaration!.mrn).trim().length > 0
      ? resolvedDeclaration!.mrn
      : "Draft CDS Entry";

  const rowBadge = hasDeclaration
    ? resolveDeclarationRowBadge({
        status: resolvedDeclaration!.status,
        cdsBadgeLabel: (resolvedDeclaration as { cdsBadgeLabel?: string }).cdsBadgeLabel,
        cdsBadgeTone: (resolvedDeclaration as { cdsBadgeTone?: string }).cdsBadgeTone,
      })
    : { label: "Loading", tone: "neutral" as const };

  const headerBadgeLabel = isSessionLoading && !hasDeclaration ? "Loading…" : rowBadge.label;
  const headerBadgeTone = rowBadge.tone;
  const headerSubtitle = hasDeclaration
    ? declarationHumanSubtitle(headerBadgeLabel, resolvedDeclaration!.status, headerBadgeTone)
    : "";
  const HeaderBadgeIcon = hasDeclaration ? badgeIconForTone(headerBadgeTone) : FileText;
  const headerBadgeClass = badgeToneClassName(headerBadgeTone);
  const hmrcIsLive = orgHmrc?.hmrcMode === "live";
  const hmrcEnvironmentLabel = hmrcIsLive ? "Live" : "Sandbox";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {showWorkspaceChrome && (
        <div className="px-8 pt-6 pb-4">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="relative rounded-md border border-slate-200 bg-white p-5">
              <button
                onClick={() => router.push("/dashboard/declarations")}
                className="group absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Back to declarations"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <div className="flex items-center justify-between gap-4 pl-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight text-slate-900">{declarationTitle}</h1>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${headerBadgeClass}`}
                    >
                      <HeaderBadgeIcon className="h-3 w-3" />
                      {headerBadgeLabel}
                    </span>
                  </div>
                  {headerSubtitle && headerSubtitle !== headerBadgeLabel && (
                    <p className={cn("text-xs font-medium", mrnSubtitleClass(headerBadgeTone))}>{headerSubtitle}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    EORI: {resolvedDeclaration?.eori || "Not set"} • Route: {resolvedDeclaration?.route || "Unknown"}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">HMRC Environment</p>
                  <div className="mt-0.5 flex items-center justify-end gap-1.5">
                    <div
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        hmrcIsLive ? "bg-emerald-500" : "bg-blue-500",
                      )}
                    />
                    <span className="text-xs text-slate-500">{hmrcEnvironmentLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            <nav className="flex gap-1 rounded-lg bg-slate-100/80 p-1">
              {steps.map((step) => {
                const isActive = pathname === step.path;
                const Icon = step.icon;
                const tabClass = cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors duration-150",
                  isActive
                    ? "bg-white text-black shadow-sm"
                    : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-900",
                  step.disabled && "cursor-not-allowed opacity-50 pointer-events-none",
                );

                if (step.disabled) {
                  return (
                    <span key={step.id} className={tabClass} aria-disabled="true">
                      <Icon className="h-3.5 w-3.5 text-slate-400" />
                      {step.name}
                    </span>
                  );
                }

                return (
                  <Link
                    key={step.id}
                    href={step.path}
                    prefetch
                    aria-current={isActive ? "page" : undefined}
                    className={tabClass}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
                    {step.name}
                  </Link>
                );
              })}
            </nav>

            {estimateReady && financialEstimate && (
              <PreClearanceEstimate compact {...financialEstimate} />
            )}
          </div>
        </div>
      )}

      <div className="flex-1 px-8 pb-8">
        <div className="mx-auto max-w-5xl">
          {isAuthLoading || isSessionLoading ? (
            <DeclarationWorkspaceLoader />
          ) : isSignedOut ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-slate-500">Session expired or not signed in.</p>
              <button onClick={() => router.push("/")} className="text-xs text-blue-600 hover:underline">
                Return to Home
              </button>
            </div>
          ) : isConvexMissing ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-slate-500">Convex authentication not active for this session.</p>
              <button onClick={() => window.location.reload()} className="text-xs text-blue-600 hover:underline">
                Refresh Session
              </button>
            </div>
          ) : isNotFound ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-slate-500">Declaration not found.</p>
              <button onClick={() => router.push("/dashboard/declarations")} className="text-xs text-blue-600 hover:underline">
                Return to List
              </button>
            </div>
          ) : (
            <div
              key={pathname}
              className="min-h-[28rem] animate-in fade-in duration-200 fill-mode-both"
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
