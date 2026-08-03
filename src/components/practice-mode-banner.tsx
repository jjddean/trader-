"use client";

import { Info } from "lucide-react";
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
      className="mx-4 mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-slate-900"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-2 sm:gap-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">HMRC Testing Environment</p>
          <ul className="mt-1 space-y-0.5 text-xs leading-snug text-slate-600">
            <li>
              Connect your{" "}
              <PracticeSandboxTestUserModalLink className="font-medium text-blue-700 underline hover:text-blue-900">
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
        <PracticeModeGuideModalLink className="shrink-0 text-xs font-medium text-blue-700 underline hover:text-blue-900">
          How the test environment works
        </PracticeModeGuideModalLink>
      </div>
    </div>
  );
}
