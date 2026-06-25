"use client";

import { TreImportUpload } from "@/components/tre-import-upload";
import { TreOpportunities } from "@/components/tre-opportunities";

export default function ImportTrePage() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Import TRE data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload HMRC TRE CSV exports to improve duty estimates and HS suggestions.
        </p>
      </div>
      <TreImportUpload />
      <TreOpportunities />
    </div>
  );
}
