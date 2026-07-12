import { EndUserStatementPage } from "@/components/trade-compliance/end-user-statement-page";

export default async function EndUserStatementRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <EndUserStatementPage token={token} />;
}
