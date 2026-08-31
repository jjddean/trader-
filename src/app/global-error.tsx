"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="m-0 font-sans">
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center">
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full border border-red-100 bg-red-50 shadow-sm">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="mb-3 text-[32px] font-bold tracking-tight text-[#020817]">
            Something went wrong
          </h1>
          <p className="mx-auto mb-6 max-w-md text-[16px] leading-relaxed text-slate-600">
            We encountered an unexpected error while trying to render this page.
            Try your request again — if it keeps happening, quote the reference below.
          </p>
          {error.digest && (
            <p className="mb-10 font-mono text-[12px] text-slate-400">
              Reference {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex h-[44px] items-center justify-center gap-2 rounded-md bg-[#020817] px-8 text-[14px] font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
