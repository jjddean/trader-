"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { UserSync } from "@/components/auth/user-sync";

/**
 * Dashboard requires an active Clerk org (except admins).
 * Portal clients without an org are redirected to /portal — never choose-organization.
 */
export function OrgWorkspaceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const portalProfile = useQuery(
    api.client_portal.getMyClientProfile,
    isAuthenticated ? {} : "skip",
  );
  const syncUser = useMutation(api.users.syncUser);
  const ensureBinding = useMutation(api.client_portal.ensurePortalClerkBinding);
  const resolvingRef = useRef(false);

  const jwtAdmin = user?.publicMetadata?.role === "admin";
  const isAdmin = jwtAdmin || dbUser?.role === "admin";
  const orgCheckReady =
    isLoaded && isUserLoaded && isSignedIn && !isConvexLoading && isAuthenticated;
  const needsOrg = orgCheckReady && !isAdmin && !orgId;

  useEffect(() => {
    if (!needsOrg || resolvingRef.current) return;

    if (portalProfile) {
      router.replace("/portal");
      return;
    }

    // Still loading profile.
    if (portalProfile === undefined) return;

    // Profile null — sync Clerk email first (JWT often omits it), then bind.
    resolvingRef.current = true;
    const email = user?.primaryEmailAddress?.emailAddress?.trim() ?? "";

    void (async () => {
      try {
        if (email) {
          await syncUser({
            name: user?.fullName ?? undefined,
            email,
            orgId: undefined,
            role: user?.publicMetadata?.role as string | undefined,
          });
        }
        const result = await ensureBinding();
        if (result.ok) {
          router.replace("/portal");
          return;
        }
        router.replace("/after-auth");
      } catch {
        router.replace("/after-auth");
      } finally {
        resolvingRef.current = false;
      }
    })();
  }, [needsOrg, portalProfile, user, syncUser, ensureBinding, router]);

  if (!isLoaded || !isUserLoaded) {
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
      <>
        <UserSync />
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </>
    );
  }

  return <>{children}</>;
}
