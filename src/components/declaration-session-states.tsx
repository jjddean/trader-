"use client";

import { Loader2 } from "lucide-react";

/** Full workspace content-area loader — layout only. */
export function DeclarationWorkspaceLoader() {
  return (
    <div className="flex min-h-[28rem] flex-col items-center justify-center gap-3 py-16">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      <p className="text-xs text-slate-400">Loading declaration…</p>
    </div>
  );
}

/** Tab content placeholder — matches workspace card layout, no layout shift. */
export function DeclarationPageSkeleton() {
  return (
    <div className="animate-in fade-in duration-200 space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 rounded-md bg-slate-200/70 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded-md bg-slate-100 animate-pulse" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-5">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-start gap-3">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-slate-100 animate-pulse" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded-md bg-slate-200/70 animate-pulse" />
                <div className="h-3 w-4/5 rounded-md bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use DeclarationWorkspaceLoader or DeclarationPageSkeleton */
export function DeclarationLoadingSpinner() {
  return <DeclarationWorkspaceLoader />;
}

export function ConvexSessionMissing() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <p className="text-sm text-slate-500">Convex authentication not active for this session.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="text-xs text-blue-600 hover:underline"
      >
        Refresh Session
      </button>
    </div>
  );
}

export function isConvexSessionMissing(
  isLoaded: boolean,
  isSignedIn: boolean,
  isConvexAuthLoading: boolean,
  isAuthenticated: boolean,
): boolean {
  return isLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated;
}
