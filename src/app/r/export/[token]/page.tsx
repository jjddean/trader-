import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Legacy review tokens were reusable credentials embedded in URLs. New
 * handoffs use a hashed, HttpOnly-cookie session at /r/export/review.
 */
export default function LegacyExportConsultantReviewRoute() {
  redirect("/r/export/unavailable");
}
