"use client";

import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { afterAuthRedirectUrl } from "@/lib/portal/portal-auth-redirect";

function SignInInner() {
  const searchParams = useSearchParams();
  const redirectParam =
    searchParams.get("redirect_url") || searchParams.get("force_redirect_url");

  const afterAuthUrl = afterAuthRedirectUrl(redirectParam);
  const isPortal = afterAuthUrl === "/portal" || afterAuthUrl.startsWith("/portal/");
  const signUpUrl = isPortal
    ? `/sign-up?redirect_url=${encodeURIComponent(afterAuthUrl)}`
    : "/sign-up";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <SignIn
        signUpUrl={signUpUrl}
        forceRedirectUrl={afterAuthUrl}
        fallbackRedirectUrl={afterAuthUrl}
        signUpForceRedirectUrl={afterAuthUrl}
        signUpFallbackRedirectUrl={afterAuthUrl}
      />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
