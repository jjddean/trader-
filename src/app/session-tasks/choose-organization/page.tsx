"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreateOrganization,
  TaskChooseOrganization,
  useAuth,
  useClerk,
  useSession,
  useUser,
} from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../../convex/_generated/api";

/**
 * Clerk may send new signups here for the org session task — before our onboarding.
 * If onboarding is incomplete, send them to /onboarding first.
 * Brokers who finished the form get create/join org here.
 */
export default function ChooseOrganizationPage() {
  const router = useRouter();
  const { isLoaded, orgId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { session } = useSession();
  const { signOut } = useClerk();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const portalProfile = useQuery(
    api.client_portal.getMyClientProfile,
    isAuthenticated ? {} : "skip",
  );
  const onboarding = useQuery(api.onboarding.getStatus, isAuthenticated ? {} : "skip");
  const syncUser = useMutation(api.users.syncUser);
  const ensureBinding = useMutation(api.client_portal.ensurePortalClerkBinding);
  const portalCheckRef = useRef(false);
  const [portalResolved, setPortalResolved] = useState(false);

  const currentTaskKey =
    session && "currentTask" in session && session.currentTask
      ? String((session.currentTask as { key?: string }).key ?? "")
      : "";
  const hasChooseOrgTask = currentTaskKey === "choose-organization";

  useEffect(() => {
    if (orgId) router.replace("/dashboard");
  }, [orgId, router]);

  useEffect(() => {
    if (portalProfile) {
      router.replace("/portal");
      return;
    }
    if (!isAuthenticated || isConvexLoading || !isUserLoaded) return;
    if (portalProfile === undefined) return;
    if (portalCheckRef.current) return;

    portalCheckRef.current = true;
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
        const bind = await ensureBinding();
        if (bind.ok) {
          router.replace("/portal");
          return;
        }
      } catch {
        // Fall through.
      } finally {
        setPortalResolved(true);
      }
    })();
  }, [
    portalProfile,
    isAuthenticated,
    isConvexLoading,
    isUserLoaded,
    user,
    syncUser,
    ensureBinding,
    router,
  ]);

  useEffect(() => {
    if (!portalResolved || portalProfile || orgId) return;
    if (onboarding == null) return;
    if (!onboarding.completedAt) {
      router.replace("/onboarding");
      return;
    }
    if (onboarding.path === "managed_service") {
      router.replace("/portal");
    }
  }, [portalResolved, portalProfile, orgId, onboarding, router]);

  const waiting =
    !isLoaded ||
    !isUserLoaded ||
    isConvexLoading ||
    (isAuthenticated && portalProfile === undefined) ||
    (isAuthenticated && portalProfile === null && !portalResolved) ||
    (portalResolved && !portalProfile && !orgId && onboarding === undefined) ||
    (onboarding && !onboarding.completedAt) ||
    (onboarding?.path === "managed_service");

  if (waiting || portalProfile || orgId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex flex-col items-center gap-4">
        {hasChooseOrgTask ? (
          <TaskChooseOrganization redirectUrlComplete="/dashboard" />
        ) : (
          <div className="w-full max-w-[25rem]">
            <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
          </div>
        )}
        <p className="max-w-sm text-center text-[11px] text-slate-400">
          <button
            type="button"
            onClick={() => void signOut({ redirectUrl: "/sign-in" })}
            className="underline hover:text-slate-600"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  );
}
