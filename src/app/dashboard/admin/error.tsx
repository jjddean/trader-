"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { userMessageFromError, userErrorCode } from "@/lib/convex-errors";

/**
 * Segment boundary for the admin area.
 *
 * Without it, a single failing admin query — `requireAdmin` refusing, or a query
 * exceeding a Convex read limit — unmounts the whole app into the root
 * `src/app/error.tsx`, which looks identical to a total crash and says nothing
 * about which call failed. Deliberate refusals arrive as ConvexError and carry a
 * readable message; anything else stays redacted and shows the digest instead,
 * which is the handle for the matching entry in the Convex logs.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin area error:", error);
  }, [error]);

  const code = userErrorCode(error);
  const message = userMessageFromError(
    error,
    "This admin view could not load. The details are in the browser console.",
  );

  return (
    <div className="mx-auto max-w-2xl p-8">
      <section className="rounded-xl border border-red-100 bg-white p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900">Admin view unavailable</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{message}</p>

            {code === "forbidden" && (
              <p className="mt-2 text-xs text-slate-500">
                This account is not an admin. Set Clerk public metadata{" "}
                <code className="rounded bg-slate-100 px-1">{`{"role":"admin"}`}</code> or add the
                address to the Convex <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code>{" "}
                list, then sign out and back in.
              </p>
            )}

            {code === "unauthenticated" && (
              <p className="mt-2 text-xs text-slate-500">
                Sign out and back in to refresh the session, then reopen this page.
              </p>
            )}

            {error.digest && (
              <p className="mt-3 font-mono text-[11px] text-slate-400">
                Reference {error.digest}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-black px-3 text-xs font-medium text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
              <Link href="/dashboard" className="text-xs text-blue-600 hover:underline">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
