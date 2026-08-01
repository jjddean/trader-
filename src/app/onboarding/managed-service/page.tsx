"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { OnboardingCompanyForm } from "@/components/onboarding/onboarding-company-form";

export default function OnboardingManagedServicePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in?redirect_url=/onboarding/managed-service");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <OnboardingCompanyForm
      title="Managed Service setup"
      subtitle="Organisation details for FreightCode to manage your customs"
      submitLabel="Create Managed Service Account"
      path="managed_service"
      onSuccess={() => router.replace("/portal")}
    />
  );
}
