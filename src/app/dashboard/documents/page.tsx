import { Suspense } from "react";
import { DocumentsPageClient } from "./documents-page-client";

interface DocumentsPageProps {
  searchParams: Promise<{ declaration?: string; upload?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading documents…</div>}>
      <DocumentsPageClient
        requestedDeclarationId={params.declaration ?? null}
        initialOpenUpload={params.upload === "1"}
      />
    </Suspense>
  );
}
