"use client";

import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";

/**
 * Customers must have an active Clerk org before using the dashboard.
 * Admins may work in Personal mode (legacy solo data / founder sandbox).
 *
 * Renders the dashboard shell as soon as Clerk is ready — do not block on
 * Convex auth or users.current; pages handle their own table/content loading.
 */
export function OrgWorkspaceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { user } = useUser();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");

  const jwtAdmin = user?.publicMetadata?.role === "admin";
  const isAdmin = jwtAdmin || dbUser?.role === "admin";
  const orgCheckReady = isLoaded && isSignedIn && !isConvexLoading && isAuthenticated;
  const needsOrg = orgCheckReady && !isAdmin && !orgId;

  useEffect(() => {
    if (!needsOrg) return;
    router.replace("/session-tasks/choose-organization");
  }, [needsOrg, router]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  if (needsOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return <>{children}</>;
}
