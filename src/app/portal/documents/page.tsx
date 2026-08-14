import PortalDocumentsClient from "./documents-client";

export default async function PortalDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ requirementId?: string }>;
}) {
  const params = await searchParams;
  return <PortalDocumentsClient initialRequirementId={params.requirementId} />;
}
