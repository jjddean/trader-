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
  const declaration = useQuery(
    api.declarations.getLane,
    isLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated && declarationId ? { id: declarationId } : "skip",
  );

  const isSessionLoading =
    !isLoaded || isConvexAuthLoading || (isSignedIn && isAuthenticated && declaration === undefined);
  const isSignedOut = isLoaded && !isConvexAuthLoading && !isSignedIn;
  const isConvexMissing = isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated;
  const isNotFound = isLoaded && isSignedIn && isAuthenticated && declaration === null;
  const hasDeclaration = Boolean(declaration);

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

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {hasDeclaration && (
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/declarations")}
                className="group flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 transition-colors hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4 text-gray-400 group-hover:text-gray-900" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-gray-900">{declarationTitle}</h1>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.625rem] font-medium ${headerBadgeClass}`}
                  >
                    <HeaderBadgeIcon className={cn("h-3 w-3", isSessionLoading && "animate-spin")} />
                    {headerBadgeLabel}
                  </span>
                </div>
                <p className={cn("text-xs font-medium", mrnSubtitleClass(headerBadgeTone))}>{headerSubtitle}</p>
                <p className="text-xs text-gray-500">
                  EORI: {declaration!.eori || "Not set"} • Route: {declaration!.route || "Unknown"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">HMRC Environment</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-mono text-gray-600">Sandbox</span>
                </div>
              </div>
            </div>
          </div>

          <nav className="mt-6 flex gap-1 rounded-lg bg-gray-100/50 p-1">
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
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50",
                    step.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-blue-600" : "text-gray-400")} />
                  {step.name}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-5xl">
          {isSignedOut ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-gray-500">Session expired or not signed in.</p>
              <button onClick={() => router.push("/")} className="text-xs text-blue-600 hover:underline">
                Return to Home
              </button>
            </div>
          ) : isConvexMissing ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-gray-500">Convex authentication not active for this session.</p>
              <button onClick={() => window.location.reload()} className="text-xs text-blue-600 hover:underline">
                Refresh Session
              </button>
            </div>
          ) : isNotFound ? (
            <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
              <p className="text-sm text-gray-500">Declaration not found.</p>
              <button onClick={() => router.push("/dashboard/declarations")} className="text-xs text-blue-600 hover:underline">
                Return to List
              </button>
            </div>
          ) : (
            <>
              {isSessionLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
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
