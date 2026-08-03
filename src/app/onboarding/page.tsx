"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { cn } from "@/lib/utils";

type Path = "broker" | "managed_service";

export default function OnboardingWelcomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn, orgId } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const syncUser = useMutation(api.users.syncUser);
  const status = useQuery(api.onboarding.getStatus, isAuthenticated ? {} : "skip");
  const [path, setPath] = useState<Path | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isUserLoaded || isConvexLoading) return;
    if (!isSignedIn) {
      router.replace("/sign-in?redirect_url=/onboarding");
      return;
    }
    if (!isAuthenticated || synced) return;
    const email = user?.primaryEmailAddress?.emailAddress?.trim() ?? "";
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
      } finally {
        setSynced(true);
      }
    })();
  }, [
    isLoaded,
    isUserLoaded,
    isConvexLoading,
    isSignedIn,
    isAuthenticated,
    synced,
    user,
    orgId,
    syncUser,
    router,
  ]);

  useEffect(() => {
    if (!status) return;
    if (status.completedAt && status.path === "broker") {
      router.replace("/session-tasks/choose-organization");
      return;
    }
    if (status.completedAt && status.path === "managed_service") {
      router.replace("/portal");
    }
  }, [status, router]);

  if (!isLoaded || !isSignedIn || isConvexLoading || !synced || status === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <OnboardingShell>
      <div className="border-b border-slate-100 px-6 py-5">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">
          Welcome to{" "}
          <span className="inline-flex items-baseline whitespace-nowrap leading-none">
            <span className="font-bold">freight</span>
            <span className="font-bold text-slate-600">code</span>
            <span className="ml-[-1px] -translate-y-1 text-[10px] font-normal text-slate-600">®</span>
          </span>
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          How would you like to use <strong className="font-semibold">freightcode</strong>?
        </p>
      </div>
      <div className="space-y-3 px-6 py-5">
        <button
          type="button"
          onClick={() => setPath("broker")}
          className={cn(
            "w-full rounded-lg border px-4 py-3 text-left transition-colors",
            path === "broker"
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:border-slate-300",
          )}
        >
          <span className="block text-[13px] font-semibold text-slate-900">Broker</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
            Use <strong className="font-semibold">freightcode</strong> to prepare customs
            declarations and manage services for the businesses you represent.
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPath("managed_service")}
          className={cn(
            "w-full rounded-lg border px-4 py-3 text-left transition-colors",
            path === "managed_service"
              ? "border-slate-900 bg-slate-50"
              : "border-slate-200 hover:border-slate-300",
          )}
        >
          <span className="block text-[13px] font-semibold text-slate-900">Managed Service</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
            Appoint <strong className="font-semibold">freightcode</strong> to prepare and manage
            customs declarations on your behalf.
          </span>
        </button>
        <button
          type="button"
          disabled={!path}
          onClick={() => {
            if (path === "broker") router.push("/onboarding/broker");
            if (path === "managed_service") router.push("/onboarding/managed-service");
          }}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-black text-[13px] font-medium text-white hover:bg-slate-800 disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </OnboardingShell>
  );
}
