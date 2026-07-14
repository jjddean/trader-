"use client";

import { AlertTriangle } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  PracticeModeGuideModalLink,
  PracticeSandboxTestUserModalLink,
} from "@/components/practice-sandbox-test-user";

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
      <div className="mx-auto flex max-w-6xl items-start gap-2 sm:gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">HMRC Testing Environment</p>
          <ul className="mt-1 space-y-0.5 text-xs leading-snug text-amber-900/90">
            <li>
              Connect your{" "}
              <PracticeSandboxTestUserModalLink className="font-medium underline hover:text-amber-950">
                HMRC Test User
              </PracticeSandboxTestUserModalLink>{" "}
              to submit sandbox declarations.
            </li>
            <li>
              Validate workflows and familiarise yourself with Freightcode before enabling live
              customs submissions.
            </li>
          </ul>
        </div>
        <PracticeModeGuideModalLink className="shrink-0 text-xs font-medium text-amber-900 underline hover:text-amber-950">
          How the test environment works
        </PracticeModeGuideModalLink>
      </div>
    </div>
  );
}
