"use client";

import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useRef } from "react";
import { clearDashboardUserCaches } from "@/lib/clear-dashboard-user-caches";

export function UserSync() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { orgId, isLoaded: isAuthLoaded } = useAuth();
  const { organization } = useOrganization();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const ensureOrgPractice = useMutation(api.org_hmrc.ensurePracticeMode);
  const syncedKey = useRef<string | null>(null);
  const previousUserIdRef = useRef<string | undefined>(undefined);

  const userId = user?.id;
  const userRole = String(user?.publicMetadata?.role ?? "");
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      if (previousUserIdRef.current !== undefined) {
        clearDashboardUserCaches();
      }
      syncedKey.current = null;
      previousUserIdRef.current = userId;
    }
    if (!userId) {
      syncedKey.current = null;
    }
  }, [userId]);

  useEffect(() => {
    if (!isClerkLoaded || !isAuthLoaded || !userId || !isAuthenticated) return;

    const syncKey = [userId, userRole, userEmail, orgId ?? "personal"].join(":");
    if (syncedKey.current === syncKey) return;

    syncedKey.current = syncKey;
    let cancelled = false;

    syncUser({
      name: user?.fullName ?? undefined,
      email: userEmail,
      orgId: orgId ?? undefined,
      role: user?.publicMetadata?.role as string | undefined,
    })
      .then(() => {
        if (cancelled || !orgId) return;
        return ensureOrgPractice({
          orgId,
          orgName: organization?.name ?? undefined,
        }).catch((err) => {
          console.error("Org HMRC practice init failed:", err);
        });
      })
      .catch((err) => {
        console.error("User sync failed:", err);
        if (syncedKey.current === syncKey) {
          syncedKey.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isClerkLoaded,
    isAuthLoaded,
    isAuthenticated,
    orgId,
    organization?.name,
    userId,
    userRole,
    userEmail,
    user?.fullName,
    user?.publicMetadata?.role,
    syncUser,
    ensureOrgPractice,
  ]);

  return null;
}
