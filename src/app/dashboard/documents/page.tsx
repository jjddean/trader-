import { DocumentsPageClient } from "./documents-page-client";

interface DocumentsPageProps {
  searchParams: Promise<{ declaration?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  return <DocumentsPageClient requestedDeclarationId={params.declaration ?? null} />;
}
