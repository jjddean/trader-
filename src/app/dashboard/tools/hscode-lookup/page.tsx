"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HSCodeLookup } from "@/components/tools/HSCodeLookup";

function HSCodeLookupPageContent() {
  const searchParams = useSearchParams();
  const declarationId = searchParams.get("declarationId") ?? undefined;
  const itemId = searchParams.get("itemId") ?? undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-8">
      {declarationId && itemId && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Applying to a declaration item — pick a code and click <strong>Apply</strong>, then review the
          description against your invoice on the goods item form.
        </p>
      )}
      <HSCodeLookup variant="card" declarationId={declarationId} itemId={itemId} />
    </div>
  );
}

export default function HSCodePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading HS Code Lookup…</div>}>
      <HSCodeLookupPageContent />
    </Suspense>
  );
}
