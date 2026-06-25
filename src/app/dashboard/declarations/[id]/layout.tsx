"use client";

import React from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useQuery, useConvexAuth } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { FileText, ListChecks, UploadCloud, Activity, Send, Loader2, ArrowLeft } from "lucide-react";
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
  const financialEstimate = useQuery(
    api.declarations.getDeclarationFinancialEstimate,
    authReady && declarationId ? { declarationId } : "skip",
  );
  const orgHmrc = useQuery(
    api.org_hmrc.getModeForDeclaration,
    authReady && declarationId ? { declarationId } : "skip",
  );
  const estimateReady = financialEstimate !== undefined;

  const isSessionLoading = !isLoaded || (authReady && declaration === undefined);
  const isSignedOut = isLoaded && !isConvexAuthLoading && !isSignedIn;
  const isConvexMissing = isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated;
  const isNotFound = authReady && declaration === null;
  const hasDeclaration = authReady && Boolean(declaration);

  const steps = [
    { id: "overview", name: "1. Core Schema", icon: FileText, path: `/dashboard/declarations/${declarationId}` },
    { id: "items", name: "2. Goods Items", icon: ListChecks, path: `/dashboard/declarations/${declarationId}/items` },
    { id: "submit", name: "3. Submission", icon: Send, path: `/dashboard/declarations/${declarationId}/submit` },
    { id: "status", name: "4. HMRC Status", icon: Activity, path: `/dashboard/declarations/${declarationId}/status` },
    { id: "documents", name: "5. Secure Upload", icon: UploadCloud, path: `/dashboard/declarations/${declarationId}/documents`, disabled: !declaration?.mrn },
  ];

  const declarationTitle =
    hasDeclaration && declaration!.mrn && String(declaration!.mrn).trim().length > 0
      ? declaration!.mrn
      : "Draft CDS Entry";

  const rowBadge = hasDeclaration
    ? resolveDeclarationRowBadge({
        status: declaration!.status,
        cdsBadgeLabel: (declaration as { cdsBadgeLabel?: string }).cdsBadgeLabel,
        cdsBadgeTone: (declaration as { cdsBadgeTone?: string }).cdsBadgeTone,
      })
    : { label: "Loading", tone: "neutral" as const };

  const headerBadgeLabel = rowBadge.label;
  const headerBadgeTone = rowBadge.tone;
  const headerSubtitle = hasDeclaration
    ? declarationHumanSubtitle(headerBadgeLabel, declaration!.status, headerBadgeTone)
    : "";
  const HeaderBadgeIcon = hasDeclaration ? badgeIconForTone(headerBadgeTone) : Loader2;
  const headerBadgeClass = badgeToneClassName(headerBadgeTone);
  const hmrcIsLive = orgHmrc?.hmrcMode === "live";
  const hmrcEnvironmentLabel = hmrcIsLive ? "Live" : "Sandbox";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {hasDeclaration && (
        <div className="px-8 pt-6 pb-4">
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="relative rounded-md border border-slate-200 bg-white p-5 shadow-sm">
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
                      <HeaderBadgeIcon className={cn("h-3 w-3", isSessionLoading && "animate-spin")} />
                      {headerBadgeLabel}
                    </span>
                  </div>
                  {headerSubtitle && headerSubtitle !== headerBadgeLabel && (
                    <p className={cn("text-xs font-medium", mrnSubtitleClass(headerBadgeTone))}>{headerSubtitle}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    EORI: {declaration!.eori || "Not set"} • Route: {declaration!.route || "Unknown"}
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

                return (
                  <button
                    key={step.id}
                    onClick={() => !step.disabled && router.push(step.path)}
                    disabled={step.disabled}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-white text-black shadow-sm"
                        : "text-slate-500 hover:bg-slate-200/60 hover:text-slate-900",
                      step.disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600" : "text-slate-400")} />
                    {step.name}
                  </button>
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
          {isSignedOut ? (
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
            <>
              {isSessionLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              )}
              <div className={isSessionLoading ? "hidden" : undefined}>{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
