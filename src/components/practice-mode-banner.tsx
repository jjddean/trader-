"use client";

import { AlertTriangle } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PracticeSandboxTestUserModalLink } from "@/components/practice-sandbox-test-user";

export function PracticeModeBanner() {
  const { organization } = useOrganization();
  const orgId = organization?.id || "";

  const orgHmrc = useQuery(
    api.org_hmrc.getModeForOrg,
    orgId ? { orgId } : "skip",
  );

  if (!orgId || orgHmrc?.hmrcMode === "live") {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-2 text-xs leading-relaxed">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold">Practice mode active</p>
          <p>
            Submissions go to HMRC&apos;s test environment (TDR) only — not legally binding. Use
            your{" "}
            <PracticeSandboxTestUserModalLink className="font-medium underline hover:text-amber-900">
              HMRC Test User credentials
            </PracticeSandboxTestUserModalLink>{" "}
            when connecting (not your live Government Gateway). Enter your real EORI and trade data
            on declaration forms.
          </p>
        </div>
      </div>
    </div>
  );
}
