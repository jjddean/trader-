"use client";

import Link from "next/link";
import { TaskChooseOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { OnboardingShell } from "@/components/auth/onboarding-shell";
import { api } from "../../../../convex/_generated/api";

export default function ChooseOrganizationPage() {
  const { isAuthenticated } = useConvexAuth();
  const dbUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isAdmin = dbUser?.role === "admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <OnboardingShell
        step={2}
        title="Set up your company workspace"
        description="Create or join an organisation to practise customs declarations with your team. Practice mode is free — no card required."
      >
        <div className="flex justify-center">
          <TaskChooseOrganization redirectUrlComplete="/dashboard" />
        </div>
        {isAdmin && (
          <p className="mt-6 text-center text-xs text-gray-500">
            Admin:{" "}
            <Link href="/dashboard" className="font-medium text-gray-700 underline hover:text-black">
              continue in personal workspace
            </Link>
          </p>
        )}
      </OnboardingShell>
    </div>
  );
}
