import PortalMessagesClient from "./messages-client";

export default async function PortalMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ declarationId?: string; assessmentId?: string }>;
}) {
  const params = await searchParams;
  return (
    <PortalMessagesClient
      initialDeclarationId={params.declarationId}
      initialAssessmentId={params.assessmentId}
    />
  );
}
