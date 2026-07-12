export interface SanctionsScreeningSummary {
  reviewStatus: string;
  score?: number;
}

export function sanctionsOneLiner(screenings: SanctionsScreeningSummary[]): string {
  if (screenings.length === 0) return "Sanctions screening not run on this assessment.";

  const confirmed = screenings.filter((s) => s.reviewStatus === "confirmed").length;
  if (confirmed > 0) {
    return `${confirmed} potential sanctions match(es) confirmed — do not sign off until resolved.`;
  }

  const pending = screenings.filter((s) => s.reviewStatus === "pending" && (s.score ?? 0) >= 0.65).length;
  if (pending > 0) {
    return `${pending} screening hit(s) awaiting review.`;
  }

  return "No sanctions matches identified on screened parties.";
}
