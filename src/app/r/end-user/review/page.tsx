import type { Metadata } from "next";
import { EndUserStatementPage } from "@/components/trade-compliance/end-user-statement-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
  referrer: "no-referrer",
};

export default function EndUserStatementReviewRoute() {
  return <EndUserStatementPage />;
}
