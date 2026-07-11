/**
 * UK export submission routing — deterministic only (Phase 5).
 * Re-exported from src/lib/export-controls/routing.ts for tests and API routes.
 */

export type SubmissionRoute = "lite" | "spire" | "otsi" | "none";

export const ROUTING_VERIFIED_AT = "2026-07-03";
export const ROUTING_SOURCE_URL =
  "https://www.gov.uk/guidance/standard-individual-export-licences-siels";

export const LITE_GOV_UK_URL = "https://www.gov.uk/guidance/apply-to-export-controlled-goods";

/** ISO 3166-1 alpha-2 — SPIRE exception destinations (GOV.UK SIEL guidance, verified 2026-07-03). */
export const SPIRE_DESTINATION_CODES = new Set([
  "BY", // Belarus
  "MM", // Burma (Myanmar)
  "IR", // Iran
  "IQ", // Iraq
  "LB", // Lebanon
  "LY", // Libya
  "KP", // North Korea
  "RU", // Russia
  "SY", // Syria
  "VE", // Venezuela
  "ZW", // Zimbabwe
]);

/** Control entries that must use SPIRE (not LITE). Normalised uppercase, no spaces. */
export const SPIRE_ONLY_ENTRY_CODES = new Set([
  "2D352",
  "3D006",
  "3E003H",
  "8A002O4",
  "9E003A2E",
  "9E003K",
]);

export interface RoutingInput {
  originJurisdiction?: "GB" | "NI";
  destinationCountry?: string;
  /** Approved control entries across all products (empty string = explicitly not controlled). */
  approvedControlEntries: string[];
  /** Non-SIEL licence paths force SPIRE. */
  licenceType?: "siel" | "f680" | "sitl" | "other";
}

export interface RoutingResult {
  route: SubmissionRoute;
  reasons: string[];
  niReviewRequired: boolean;
  /** Exact UI copy per BUILD-PLAN Phase 5. */
  headline: string;
  govUkUrl: string;
  verifiedAt: string;
  sourceUrl: string;
}

export function normalizeControlEntryCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function isSpireOnlyEntry(entryCode: string): boolean {
  return SPIRE_ONLY_ENTRY_CODES.has(normalizeControlEntryCode(entryCode));
}

export function resolveSubmissionRoute(input: RoutingInput): RoutingResult {
  const reasons: string[] = [];
  const dest = input.destinationCountry?.trim().toUpperCase();
  const niReviewRequired = input.originJurisdiction === "NI";

  if (niReviewRequired) {
    reasons.push(
      "Northern Ireland origin — EU Dual-Use Regulation 2021/821 framing applies; flag for human review.",
    );
  }

  let route: SubmissionRoute = "lite";
  let headline = "Open official GOV.UK SIEL service";

  if (input.licenceType && input.licenceType !== "siel") {
    route = "spire";
    reasons.push(`Licence type ${input.licenceType.toUpperCase()} is not SIEL — SPIRE required.`);
    headline = "This case must be submitted in SPIRE";
  }

  if (dest && SPIRE_DESTINATION_CODES.has(dest)) {
    route = "spire";
    reasons.push(`Destination ${dest} is a sanctioned / SPIRE exception country.`);
    headline = "This case may require OTSI/SPIRE handling (sanctioned destination)";
  }

  for (const entry of input.approvedControlEntries) {
    if (!entry) continue;
    if (isSpireOnlyEntry(entry)) {
      route = "spire";
      reasons.push(`Control entry ${normalizeControlEntryCode(entry)} must be submitted in SPIRE.`);
      headline = "This case must be submitted in SPIRE";
      break;
    }
  }

  const hasControlledProduct = input.approvedControlEntries.some((e) => e.length > 0);
  if (route === "lite" && !hasControlledProduct && !dest) {
    route = "none";
    headline = "Set destination and complete classification to determine submission route.";
  }

  return {
    route,
    reasons,
    niReviewRequired,
    headline,
    govUkUrl: route === "spire" ? ROUTING_SOURCE_URL : LITE_GOV_UK_URL,
    verifiedAt: ROUTING_VERIFIED_AT,
    sourceUrl: ROUTING_SOURCE_URL,
  };
}
