"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";

/**
 * Post sign-in router.
 * Portal invite → /portal.
 * Org/admin → /dashboard.
 * Onboarding incomplete → /onboarding.
 * Broker onboarded → choose-organization.
 * Managed onboarded → /portal.
 */
export default function AfterAuthPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const ensureBinding = useMutation(api.client_portal.ensurePortalClerkBinding);
  const onboarding = useQuery(api.onboarding.getStatus, isAuthenticated ? {} : "skip");
  const ranRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isUserLoaded || isConvexLoading) return;
    if (!isSignedIn) {
      router.replace("/sign-in");
      return;
    }
    if (!isAuthenticated || onboarding === undefined || ranRef.current) return;

    const email = user?.primaryEmailAddress?.emailAddress?.trim() ?? "";
    const isAdmin = user?.publicMetadata?.role === "admin";

    ranRef.current = true;

    void (async () => {
      try {
        if (email) {
          await syncUser({
            name: user?.fullName ?? undefined,
            email,
            orgId: orgId ?? undefined,
            role: user?.publicMetadata?.role as string | undefined,
          });
        }

        if (orgId || isAdmin) {
          router.replace("/dashboard");
          return;
        }

        const bind = await ensureBinding();
        if (bind.ok) {
          router.replace("/portal");
          return;
        }

        if (!onboarding?.completedAt) {
          router.replace("/onboarding");
          return;
        }

        if (onboarding.path === "managed_service") {
          router.replace("/portal");
          return;
        }

        router.replace("/session-tasks/choose-organization");
      } catch (err) {
        // Routing must still resolve, but the failure has to be visible —
        // silently landing on /onboarding hid real sync/binding faults.
        console.error("[after-auth] post sign-in routing failed", err);
        if (orgId || isAdmin) {
          router.replace("/dashboard");
          return;
        }
        router.replace("/onboarding");
      }
    })();
  }, [
    isLoaded,
    isUserLoaded,
    isSignedIn,
    isAuthenticated,
    isConvexLoading,
    orgId,
    user,
    onboarding,
    syncUser,
    ensureBinding,
    router,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Signing you in…
    </div>
  );
}
