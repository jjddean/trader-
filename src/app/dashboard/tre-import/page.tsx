"use client";

import { TreWorkspace } from "@/components/tre-workspace";

export default function ImportTrePage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Customs history</h1>
        <p className="mt-1 text-sm text-slate-500">
          Turn your HMRC TRE exports into duty reviews, compliance checks, and HS suggestions for new
          declarations.
        </p>
      </div>
      <TreWorkspace />
    </div>
  );
}
