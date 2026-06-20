"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

/**
 * Customers must have an active Clerk org before using the dashboard.
 * Admins may work in Personal mode (legacy solo data / founder sandbox).
 */
export function OrgWorkspaceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");

  const checking =
    !isLoaded || !isSignedIn || isConvexLoading || (isAuthenticated && dbUser === undefined);
  const isAdmin = dbUser?.role === "admin";
  const needsOrg = isAuthenticated && !isAdmin && !orgId;

  useEffect(() => {
    if (checking || !needsOrg) return;
    router.replace("/session-tasks/choose-organization");
  }, [checking, needsOrg, router]);

  if (checking || needsOrg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading workspace…
      </div>
    );
  }

  return <>{children}</>;
}
