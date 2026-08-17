"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { UserSync } from "@/components/auth/user-sync";
import { PortalHeader } from "@/components/portal/portal-header";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { compactClerkAppearance, compactProfileModalAppearance } from "@/lib/clerk-compact";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const userAppearance = {
  variables: compactClerkAppearance.variables,
  elements: {
    rootBox: "shrink-0",
    avatarBox: "h-7 w-7",
    userButtonPopoverCard: "w-52 rounded-md border border-slate-200 shadow-lg",
    userButtonPopoverMain: "gap-1 p-1.5",
    userButtonPopoverActions: "gap-0 p-1.5 pt-0",
    userButtonPopoverActionButton: "rounded px-1.5 py-1",
    userButtonPopoverActionButtonText: "text-[12px]",
    userButtonPopoverActionButtonIcon: "h-3.5 w-3.5",
    userButtonPopoverFooter: "hidden",
    userPreviewAvatarBox: "h-8 w-8",
    userPreviewMainIdentifier: "text-[12px] font-medium leading-tight",
    userPreviewSecondaryIdentifier: "text-[10px] leading-tight text-slate-500",
  },
} as const;

function titleForPath(pathname: string): { title: string; badge: string } {
  if (pathname.startsWith("/portal/declarations/")) {
    return { title: "Declaration", badge: "VIEW" };
  }
  if (pathname.startsWith("/portal/declarations")) {
    return { title: "Declarations", badge: "CDS" };
  }
  if (pathname.startsWith("/portal/documents")) {
    return { title: "Documents", badge: "FILES" };
  }
  if (pathname.startsWith("/portal/charges")) {
    return { title: "Charges", badge: "DUTY" };
  }
  if (pathname.startsWith("/portal/compliance/")) {
    return { title: "Export controls", badge: "CASE" };
  }
  if (pathname.startsWith("/portal/compliance")) {
    return { title: "Export controls", badge: "EC" };
  }
  if (pathname.startsWith("/portal/messages")) {
    return { title: "Messages", badge: "INBOX" };
  }
  if (pathname.startsWith("/portal/company")) {
    return { title: "Company", badge: "PROFILE" };
  }
  if (pathname.startsWith("/portal/dashboard") || pathname === "/portal") {
    return { title: "Home", badge: "PORTAL" };
  }
  return { title: "Home", badge: "PORTAL" };
}

type StablePortalProfile = { name: string };

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const authReady = Boolean(
    isLoaded && isUserLoaded && isSignedIn && !isConvexAuthLoading && isAuthenticated,
  );

  const profile = useQuery(api.client_portal.getMyClientProfile, authReady ? {} : "skip");
  const syncUser = useMutation(api.users.syncUser);
  const ensureBinding = useMutation(api.client_portal.ensurePortalClerkBinding);
  const bindDoneRef = useRef(false);
  const [bindDone, setBindDone] = useState(false);
  /** Keep chrome mounted after first success — auth flicker must not tear the shell down. */
  const [stableProfile, setStableProfile] = useState<StablePortalProfile | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authReady || bindDoneRef.current) return;
    bindDoneRef.current = true;
    const email = user?.primaryEmailAddress?.emailAddress?.trim() ?? "";
    void (async () => {
      try {
        if (email) {
          await syncUser({
            name: user?.fullName ?? undefined,
            email,
            role: user?.publicMetadata?.role as string | undefined,
          });
        }
        await ensureBinding();
      } catch {
        // Profile query will still decide access.
      } finally {
        setBindDone(true);
      }
    })();
  }, [authReady, user, syncUser, ensureBinding]);

  useEffect(() => {
    if (!profile && !(isLoaded && !isSignedIn)) return;
    const updateId = window.setTimeout(() => {
      setStableProfile(profile ?? null);
    }, 0);
    return () => window.clearTimeout(updateId);
  }, [isLoaded, isSignedIn, profile]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // Signed-out gate (only when we never had a portal session in this mount).
  if (isLoaded && !isSignedIn && !stableProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <h1 className="text-sm font-medium text-black">Client portal</h1>
            <p className="mt-1 text-[11px] text-slate-500">
              Create an account or sign in with the email your broker invited.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 p-6">
            <Link
              href="/sign-up?redirect_url=/portal"
              className="inline-flex h-8 items-center rounded-md bg-black px-4 text-xs font-normal text-white hover:bg-slate-800"
            >
              Create account
            </Link>
            <Link
              href="/sign-in?redirect_url=/portal"
              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // First-load only. Never replace chrome once stableProfile is set.
  if (!stableProfile) {
    if (bindDone && profile === null) {
      return (
        <div className="flex min-h-screen flex-col bg-slate-50">
          <UserSync />
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
              <span className="text-sm font-semibold tracking-tight text-slate-900">
                FreightCode Portal
              </span>
              <UserButton
                appearance={userAppearance}
                userProfileProps={{ appearance: compactProfileModalAppearance }}
              />
            </div>
          </header>
          <main className="mx-auto w-full max-w-3xl p-6">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                <h1 className="text-sm font-medium text-black">No portal access</h1>
              </div>
              <div className="space-y-3 p-6">
                <p className="text-xs text-slate-600">
                  Your account is not linked to a client portal. Ask your customs broker to enable
                  portal access for the email you used to sign in.
                </p>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading portal…
      </div>
    );
  }

  const { title, badge } = titleForPath(pathname);

  return (
    <SidebarProvider defaultOpen={true}>
      <PortalSidebar clientName={stableProfile.name} />
      <UserSync />
      <SidebarInset className="flex min-h-screen flex-col overflow-hidden bg-slate-50">
        <PortalHeader title={title} badge={badge} />
        <div ref={mainScrollRef} className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">
          <div className="p-6">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
