"use client";

import { TreImportUpload } from "@/components/tre-import-upload";

export default function ImportTrePage() {
  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-black">Import TRE data</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Upload CSV exports from HMRC Trade Reporting and Extracting to improve duty estimates, HS code suggestions,
          and historical reporting for your organisation.
        </p>
      </div>
      <TreImportUpload />
    </div>
  );
}
