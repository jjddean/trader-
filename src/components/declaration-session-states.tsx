"use client";

import { Loader2 } from "lucide-react";

export function DeclarationLoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  );
}

export function ConvexSessionMissing() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <p className="text-sm text-gray-500">Convex authentication not active for this session.</p>
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
