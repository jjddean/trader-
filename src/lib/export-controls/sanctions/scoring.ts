export interface ScoreBreakdown {
  name: number;
  address: number;
  country: number;
  dob: number;
  identifier: number;
  total: number;
  identifierExact: boolean;
}

export interface ScreeningThresholdBand {
  band: "block" | "review" | "show" | "ignore";
  label: string;
}

export function computeScreeningScore(parts: {
  name: number;
  address: number;
  country: number;
  dob: number;
  identifier: number;
  identifierExact?: boolean;
}): ScoreBreakdown {
  const identifierExact = parts.identifierExact ?? false;
  let total =
    0.55 * parts.name +
    0.15 * parts.address +
    0.1 * parts.country +
    0.1 * parts.dob +
    0.25 * parts.identifier;

  if (identifierExact) {
    total = Math.max(total, 0.97);
  } else if (parts.name >= 0.95) {
    total = Math.max(total, 0.66);
  }

  return {
    name: round(parts.name),
    address: round(parts.address),
    country: round(parts.country),
    dob: round(parts.dob),
    identifier: round(parts.identifier),
    total: round(Math.min(1, total)),
    identifierExact,
  };
}

export function thresholdBand(score: number, identifierExact: boolean): ScreeningThresholdBand {
  if (identifierExact || score >= 0.95) {
    return { band: "block", label: "Block pending human confirmation" };
  }
  if (score >= 0.8) {
    return { band: "review", label: "Mandatory review" };
  }
  if (score >= 0.65) {
    return { band: "show", label: "Show match — do not auto-block" };
  }
  if (identifierExact) {
    return { band: "review", label: "Identifier match below name threshold" };
  }
  return { band: "ignore", label: "Below screening threshold" };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Used by CLEAR gate — sanctions must be fresh and no block-band hits without review. */
export function sanctionsClearanceScore(
  snapshotFresh: boolean,
  hasBlockBandHit: boolean,
): number {
  if (!snapshotFresh) return 0;
  if (hasBlockBandHit) return 0.2;
  return 1;
}
