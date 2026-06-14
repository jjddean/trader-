"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useRef } from "react";

export function UserSync() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const syncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isClerkLoaded || !user || !isAuthenticated) return;

    const syncKey = `${user.id}:${String(user.publicMetadata?.role ?? "")}:${user.primaryEmailAddress?.emailAddress ?? ""}`;
    if (syncedKey.current === syncKey) return;

    syncUser({
      name: user.fullName ?? undefined,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      orgId: user.organizationMemberships?.[0]?.organization?.id,
      role: (user.publicMetadata?.role as string | undefined),
    })
      .then(() => {
        syncedKey.current = syncKey;
      })
      .catch((err) => {
        console.error("User sync failed:", err);
      });
  }, [
    isClerkLoaded,
    user,
    isAuthenticated,
    syncUser,
    user?.publicMetadata?.role,
    user?.primaryEmailAddress?.emailAddress,
  ]);

  return null;
}
