"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useRef } from "react";

export function UserSync() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { orgId, isLoaded: isAuthLoaded } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const ensureOrgPractice = useMutation(api.org_hmrc.ensurePracticeMode);
  const syncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isClerkLoaded || !isAuthLoaded || !user || !isAuthenticated) return;

    const syncKey = [
      user.id,
      String(user.publicMetadata?.role ?? ""),
      user.primaryEmailAddress?.emailAddress ?? "",
      orgId ?? "personal",
    ].join(":");
    if (syncedKey.current === syncKey) return;

    syncUser({
      name: user.fullName ?? undefined,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      orgId: orgId ?? undefined,
      role: user.publicMetadata?.role as string | undefined,
    })
      .then(() => {
        syncedKey.current = syncKey;
        if (orgId) {
          return ensureOrgPractice({ orgId }).catch((err) => {
            console.error("Org HMRC practice init failed:", err);
          });
        }
      })
      .catch((err) => {
        console.error("User sync failed:", err);
      });
  }, [
    isClerkLoaded,
    isAuthLoaded,
    user,
    isAuthenticated,
    orgId,
    syncUser,
    ensureOrgPractice,
    user?.publicMetadata?.role,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  return null;
}
