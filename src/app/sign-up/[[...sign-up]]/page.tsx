"use client";

import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { afterAuthRedirectUrl, isPortalReturn } from "@/lib/portal/portal-auth-redirect";

function SignUpInner() {
  const searchParams = useSearchParams();
  const redirectParam =
    searchParams.get("redirect_url") || searchParams.get("force_redirect_url");

  // Portal clients must not land on broker org setup after creating an account.
  const afterAuthUrl = isPortalReturn(redirectParam)
    ? afterAuthRedirectUrl(redirectParam)
    : "/after-auth";

  const isPortal = afterAuthUrl === "/portal" || afterAuthUrl.startsWith("/portal/");
  const signInUrl = isPortal
    ? `/sign-in?redirect_url=${encodeURIComponent(afterAuthUrl)}`
    : "/sign-in";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <SignUp
        signInUrl={signInUrl}
        forceRedirectUrl={afterAuthUrl}
        fallbackRedirectUrl={afterAuthUrl}
      />
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <SignUpInner />
    </Suspense>
  );
}
