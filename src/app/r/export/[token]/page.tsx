import { ConsultantReviewPage } from "@/components/trade-compliance/consultant-review-page";

export default async function ExportConsultantReviewRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConsultantReviewPage token={token} />;
}
