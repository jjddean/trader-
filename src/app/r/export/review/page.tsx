import type { Metadata } from "next";
import { ConsultantReviewPage } from "@/components/trade-compliance/consultant-review-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
  referrer: "no-referrer",
};

export default function ExportConsultantReviewRoute() {
  return <ConsultantReviewPage />;
}
