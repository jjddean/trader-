"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only record of this crash. Nothing is shipped to a server-side sink,
    // so the copy below must not promise that it was — and the digest is
    // rendered in production because it is the sole handle a user can quote.
    Sentry.captureException(error);
    console.error("Caught by Next.js Error Boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-slate-50 px-6 py-24 text-center font-sans">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 mb-8 border border-red-100 shadow-sm">
        <AlertTriangle className="h-10 w-10 text-red-500" />
      </div>
      
      <h1 className="mb-3 text-[32px] font-bold tracking-tight text-[#020817]">
        Something went wrong
      </h1>
      
      <p className="mb-6 max-w-md text-[16px] leading-relaxed text-slate-600 mx-auto">
        We encountered an unexpected error while trying to render this page.
        Try your request again — if it keeps happening, quote the reference below.
      </p>

      {error.digest && (
        <p className="mb-10 font-mono text-[12px] text-slate-400">
          Reference {error.digest}
        </p>
      )}
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-sm mx-auto">
        <button
          onClick={() => reset()}
          className="flex h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-md bg-[#020817] px-8 text-[14px] font-medium text-white transition-all hover:bg-slate-800 shadow-sm"
        >
          <RefreshCw className="h-4 w-4" />
          Try Again
        </button>
        
        <Link
          href="/dashboard"
          className="flex h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-8 text-[14px] font-medium text-slate-700 transition-all hover:bg-slate-50 shadow-sm"
        >
          <Home className="h-4 w-4 text-slate-400" />
          Dashboard
        </Link>
      </div>

      {/* Optional: For local debugging, display the error message */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-12 max-w-2xl text-left bg-red-50 rounded-lg p-6 w-full border border-red-100 overflow-auto">
           <p className="text-xs font-bold uppercase tracking-widest text-red-800 mb-2">Dev Only Error Details</p>
           <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap leading-relaxed">{error.message}</pre>
        </div>
      )}
    </div>
  );
}
