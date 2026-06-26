"use client";

import { useEffect, useState } from "react";
import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { ConvexSessionMissing } from "@/components/declaration-session-states";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoaded: isClerkLoaded, isSignedIn } = useAuth();
  const { isLoading: isConvexAuthLoading, isAuthenticated } = useConvexAuth();
  const userData = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const [authorized, setAuthorized] = useState(false);
  const [denied, setDenied] = useState(false);
  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowLoad(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isConvexAuthLoading || !isClerkLoaded) return;
    if (isSignedIn && !isAuthenticated) return;
    if (!isAuthenticated) {
      router.replace("/sign-in");
      return;
    }
    if (userData === undefined) return;

    if (!userData || userData.role !== "admin") {
      setDenied(true);
      setAuthorized(false);
      const timer = window.setTimeout(() => router.replace("/dashboard"), 2500);
      return () => window.clearTimeout(timer);
    }

    setDenied(false);
    setAuthorized(true);
  }, [isClerkLoaded, isSignedIn, isConvexAuthLoading, isAuthenticated, userData, router]);

  if (isClerkLoaded && isSignedIn && !isConvexAuthLoading && !isAuthenticated) {
    return <ConvexSessionMissing />;
  }

  if (denied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <p className="text-sm font-medium text-slate-900">Admin access required</p>
        <p className="max-w-md text-xs text-slate-500">
          Your account does not have the admin role. Set Clerk public metadata{" "}
          <code className="rounded bg-slate-100 px-1">{`{"role":"admin"}`}</code> or add your email to
          Convex env <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>, then sign out and back in.
        </p>
        <Link href="/dashboard" className="text-xs text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        {slowLoad && (
          <p className="max-w-sm text-center text-xs text-slate-500">
            Still loading admin session… If this persists, sign out and back in after setting admin role in Clerk.
          </p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
