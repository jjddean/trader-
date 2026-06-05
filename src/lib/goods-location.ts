/**
 * DE 5/23 — Location of Goods.
 *
 * Field format (HMRC Group 5 completion guide, retrieved 2026-05-27):
 *   Country a2 + Type of location a1 + Qualifier of the identification a1
 *   + Coded Identification of location an..35 + Additional identifier n..3
 *
 * The consolidated code from Appendix 16C column 3 (e.g. GBAUFXTFXTFXT) is
 * decomposed into the four sub-components above and rendered into WCO 64A.
 *
 * Element split below is **INFERRED**, not HMRC-cited. Source-of-truth:
 *   - HMRC completion-guide field format (cited)
 *   - DMSREJ pointer chain L016 / L110 / 04A / 04A/410 on the missing-element
 *     errors against the previous Name+ID-only shape (negative evidence only)
 *   - WCO Data Model element semantics (reference only)
 * Inference accepted by project owner 2026-05-27 in lieu of HMRC SDS contact.
 * See spec/de-5-23-goods-location.md.
 */

import { APPENDIX_16C_MARITIME_CODES } from "./generated/appendix-16c-codes";

export type GoodsLocationKind = "port" | "address";

export const GOODS_LOCATION_KIND_OPTIONS: ReadonlyArray<{
  value: GoodsLocationKind;
  label: string;
  description: string;
}> = [
  {
    value: "port",
    label: "Port / airport",
    description: "Appendix 16C maritime port code (e.g. GBAUFXTFXTFXT for Felixstowe).",
  },
  {
    value: "address",
    label: "Address-based location",
    description: "Not implemented — requires separate Appendix 16J mapping.",
  },
] as const;

/** Legacy Convex value → current kind. */
const LEGACY_PORT_KIND = "port_unlocode";

/**
 * Known Appendix 16C consolidated codes — generated from spec/hmrc-mirror/appendix-16c-maritime.psv.
 * Regenerate: node scripts/build-appendix-16c-codes.js
 */
export const KNOWN_APPENDIX_16C_CODES: Readonly<Record<string, string>> = APPENDIX_16C_MARITIME_CODES;

/**
 * Kept for backwards compatibility with UI components that still import this.
 * The Name=ID identity mapping reflects the current ODS structure: a single
 * consolidated code per port, no separate friendly name.
 */
export const PORT_LOCATION_NAME_BY_ID: Readonly<Record<string, string>> = {
  GBAUFXTFXTFXT: "GBAUFXTFXTFXT",
};

export interface ResolvedGoodsLocationXml {
  /** WCO 64A/ID — Additional identifier, only used when qualifier requires one. */
  ID: string;
  /** WCO 64A/Name — Identification of Location (positions 5+ of the consolidated code). */
  Name: string;
  /** WCO 64A/L110 — Type of location (position 3). */
  TypeCode: string;
  /** WCO 64A/04A — Address sub-element. */
  Address: {
    /** WCO 64A/04A/410 — Qualifier of identification (position 4). */
    TypeCode: string;
    /** WCO 64A/04A/L016 — Country (positions 1-2). */
    CountryCode: string;
  };
}

export function normalizeGoodsLocationKind(value: unknown): GoodsLocationKind | "" {
  const raw = String(value || "").trim();
  if (raw === "port" || raw === LEGACY_PORT_KIND) return "port";
  if (raw === "address") return "address";
  return "";
}

export function inferGoodsLocationKind(declaration: {
  goodsLocationKind?: unknown;
  locationId?: unknown;
}): GoodsLocationKind | "" {
  const explicit = normalizeGoodsLocationKind(declaration.goodsLocationKind);
  if (explicit) return explicit;
  const locationId = String(declaration.locationId || "").trim().toUpperCase();
  if (locationId && KNOWN_APPENDIX_16C_CODES[locationId]) return "port";
  return "";
}

/**
 * Decompose an Appendix 16C consolidated code into its four field-format
 * components. Returns null if the code is too short to split.
 */
export function splitConsolidatedLocationCode(code: string): {
  country: string;
  typeCode: string;
  qualifierCode: string;
  codedId: string;
} | null {
  const clean = code.trim().toUpperCase();
  if (clean.length < 5) return null;
  return {
    country: clean.slice(0, 2),
    typeCode: clean.slice(2, 3),
    qualifierCode: clean.slice(3, 4),
    codedId: clean.slice(4),
  };
}

/** PORT mode — emit the split shape per the inferred mapping. */
export function resolvePortGoodsLocation(locationId: string): ResolvedGoodsLocationXml | null {
  const split = splitConsolidatedLocationCode(locationId);
  if (!split) return null;
  return {
    Name: split.codedId,
    ID: "",
    TypeCode: split.typeCode,
    Address: {
      TypeCode: split.qualifierCode,
      CountryCode: split.country,
    },
  };
}

export function resolveGoodsLocationForXml(declaration: {
  locationId?: unknown;
  goodsLocationKind?: unknown;
}): ResolvedGoodsLocationXml {
  const kind = inferGoodsLocationKind(declaration);
  const locationId = String(declaration.locationId || "").trim().toUpperCase();

  if (kind === "port" && locationId) {
    const resolved = resolvePortGoodsLocation(locationId);
    if (resolved) return resolved;
  }

  return {
    Name: "",
    ID: "",
    TypeCode: "",
    Address: { TypeCode: "", CountryCode: "" },
  };
}

export function validateGoodsLocationForSubmit(declaration: {
  locationId?: unknown;
  goodsLocationKind?: unknown;
}): string[] {
  const errors: string[] = [];
  const locationId = String(declaration.locationId || "").trim().toUpperCase();
  if (!locationId) errors.push("Missing goods location code (DE 5/23)");

  const kind = inferGoodsLocationKind(declaration);
  if (!kind) {
    errors.push("Select goods location method: Port or Address");
    return errors;
  }

  if (kind === "address") {
    errors.push("Address-based goods location is not implemented — use Port for this lane");
    return errors;
  }

  if (kind === "port" && locationId && !KNOWN_APPENDIX_16C_CODES[locationId]) {
    errors.push(
      `Unknown Appendix 16C code "${locationId}" (DE 5/23). Known: ${Object.keys(KNOWN_APPENDIX_16C_CODES).join(", ")}`,
    );
  }

  if (kind === "port" && locationId) {
    const split = splitConsolidatedLocationCode(locationId);
    if (!split || split.country.length !== 2 || !split.typeCode || !split.qualifierCode || !split.codedId) {
      errors.push(`Goods location code "${locationId}" cannot be decomposed into Country+Type+Qualifier+CodedID`);
    }
  }

  return errors;
}
