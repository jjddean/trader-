"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEffect, useRef } from "react";

export function UserSync() {
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isClerkLoaded && user && isAuthenticated && !hasSynced.current) {
      hasSynced.current = true;
      syncUser({
        name: user.fullName ?? undefined,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        orgId: user.organizationMemberships?.[0]?.organization?.id,
        role: (user.publicMetadata?.role as string | undefined),
      }).catch((err) => {
        console.error("User sync failed:", err);
        hasSynced.current = false; // Allow retry on failure
      });
    }
  }, [isClerkLoaded, user, isAuthenticated, syncUser]);

  return null;
}
