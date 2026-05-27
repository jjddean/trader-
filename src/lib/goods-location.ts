/**
 * DE 5/23 — Goods location (CDS enumerations only).
 *
 * Sources:
 * - convex/lib/cds_h1_data_elements.ts tcmRow 144: TypeCode A = designated location (ports, ITSFs)
 * - convex/lib/cds_h1_data_elements.ts tcmRow 149: Address TypeCode U = UN/LOCODE qualifier
 * - Import completion guide: Appendix 16 column-2 codes are consolidated DE 5/23 values
 * - AEB Help Center: country/type/qualifier entered separately from the location code field
 */

export type GoodsLocationKind = "port_unlocode" | "address";

/** UI-facing kinds — not raw CDS letters typed by the user. */
export const GOODS_LOCATION_KIND_OPTIONS: ReadonlyArray<{
  value: GoodsLocationKind;
  label: string;
  description: string;
}> = [
  {
    value: "port_unlocode",
    label: "Port / airport (UN/LOCODE)",
    description:
      "Maritime or air Appendix 16 code (e.g. GBAUFXTFXTGW). Maps to designated location + UN/LOCODE qualifier.",
  },
  {
    value: "address",
    label: "Address-based location",
    description: "Physical address route — requires a different type/qualifier pair (not used for Felixstowe).",
  },
] as const;

/** L110 — Type of location (cds_h1_data_elements tcmRow 144). */
export const PORT_LOCATION_TYPE_CODE = "A";

/** 410 — Qualifier of the identification (cds_h1_data_elements tcmRow 149). */
export const PORT_LOCATION_QUALIFIER = "U";

export interface GoodsLocationCdsCodes {
  typeCode: string;
  qualifier: string;
}

export function cdsCodesForGoodsLocationKind(kind: GoodsLocationKind): GoodsLocationCdsCodes | null {
  if (kind === "port_unlocode") {
    return { typeCode: PORT_LOCATION_TYPE_CODE, qualifier: PORT_LOCATION_QUALIFIER };
  }
  // Address-based mapping is procedure-specific — no invented codes until Appendix 16 row is known.
  return null;
}

export function inferGoodsLocationKind(declaration: {
  goodsLocationKind?: unknown;
  goodsLocationTypeCode?: unknown;
  goodsLocationQualifier?: unknown;
  locationTypeCode?: unknown;
  locationQualifier?: unknown;
}): GoodsLocationKind | "" {
  const explicit = String(declaration.goodsLocationKind || "").trim();
  if (explicit === "port_unlocode" || explicit === "address") return explicit;

  const typeCode = String(
    declaration.goodsLocationTypeCode || declaration.locationTypeCode || "",
  )
    .trim()
    .toUpperCase();
  const qualifier = String(
    declaration.goodsLocationQualifier || declaration.locationQualifier || "",
  )
    .trim()
    .toUpperCase();

  if (typeCode === PORT_LOCATION_TYPE_CODE && qualifier === PORT_LOCATION_QUALIFIER) {
    return "port_unlocode";
  }
  if (typeCode || qualifier) return "address";
  return "";
}

export function resolveGoodsLocationCdsCodes(declaration: {
  goodsLocationKind?: unknown;
  goodsLocationTypeCode?: unknown;
  goodsLocationQualifier?: unknown;
  locationTypeCode?: unknown;
  locationQualifier?: unknown;
}): GoodsLocationCdsCodes | null {
  const kind = inferGoodsLocationKind(declaration);
  if (!kind) return null;
  const mapped = cdsCodesForGoodsLocationKind(kind);
  if (mapped) return mapped;

  const typeCode = String(
    declaration.goodsLocationTypeCode || declaration.locationTypeCode || "",
  )
    .trim()
    .toUpperCase();
  const qualifier = String(
    declaration.goodsLocationQualifier || declaration.locationQualifier || "",
  )
    .trim()
    .toUpperCase();
  if (typeCode && qualifier) return { typeCode, qualifier };
  return null;
}

function consolidatedPrefix(countryCode: string, typeCode: string, qualifier: string): string {
  return `${countryCode}${typeCode}${qualifier}`;
}

export interface ResolvedGoodsLocationXml {
  Name: string;
  ID: string;
  TypeCode: string;
  Address: { TypeCode: string; CountryCode: string };
}

function stripConsolidatedPrefix(
  consolidated: string,
  countryCode: string,
  typeCode: string,
  qualifier: string,
): string {
  let identification = consolidated.trim().toUpperCase();
  if (countryCode && identification.startsWith(countryCode)) {
    identification = identification.slice(countryCode.length);
  }
  if (typeCode && identification.startsWith(typeCode)) {
    identification = identification.slice(1);
  }
  if (qualifier && identification.startsWith(qualifier)) {
    identification = identification.slice(1);
  }
  return identification;
}

/**
 * Port + Appendix 16 consolidated code: split DE 5/23 for XML.
 * - Name = identification only (no GB/A/U prefix) — AEB / CDS12099
 * - TypeCode A + Address qualifier U + country GB — cds_h1 M* (CDS10001 if omitted)
 * - No ID (optional n..3 additional identifier)
 */
export function resolveGoodsLocationForXml(
  declaration: {
    locationId?: unknown;
    destinationCountry?: unknown;
    goodsLocationKind?: unknown;
    goodsLocationTypeCode?: unknown;
    goodsLocationQualifier?: unknown;
    locationTypeCode?: unknown;
    locationQualifier?: unknown;
  },
  normalizeCountryCode: (value: unknown) => string,
): ResolvedGoodsLocationXml {
  const consolidated = String(declaration.locationId || "").trim().toUpperCase();
  const countryCode = normalizeCountryCode(declaration.destinationCountry);
  const cds = resolveGoodsLocationCdsCodes(declaration);
  const typeCode = cds?.typeCode || "";
  const qualifier = cds?.qualifier || "";

  if (countryCode && typeCode && qualifier && consolidated) {
    return {
      Name: stripConsolidatedPrefix(consolidated, countryCode, typeCode, qualifier),
      ID: "",
      TypeCode: typeCode,
      Address: { TypeCode: qualifier, CountryCode: countryCode },
    };
  }

  return {
    Name: consolidated,
    ID: "",
    TypeCode: "",
    Address: { TypeCode: "", CountryCode: countryCode },
  };
}

export function validateGoodsLocationForSubmit(declaration: {
  locationId?: unknown;
  destinationCountry?: unknown;
  goodsLocationKind?: unknown;
  goodsLocationTypeCode?: unknown;
  goodsLocationQualifier?: unknown;
}): string[] {
  const errors: string[] = [];
  const locationId = String(declaration.locationId || "").trim();
  if (!locationId) errors.push("Missing goods location code (DE 5/23)");

  const kind = inferGoodsLocationKind(declaration);
  if (!kind) {
    errors.push("Missing goods location type — select Port / airport or Address");
    return errors;
  }

  const cds = cdsCodesForGoodsLocationKind(kind);
  if (!cds) {
    errors.push("Address-based goods location is not configured for this lane — use Port / airport (UN/LOCODE)");
    return errors;
  }

  const countryCode = String(declaration.destinationCountry || "").trim().toUpperCase();
  if (kind === "port_unlocode" && countryCode) {
    const prefix = consolidatedPrefix(countryCode, cds.typeCode, cds.qualifier);
    if (!locationId.toUpperCase().startsWith(prefix)) {
      errors.push(
        `Goods location code must start with ${prefix} for port/UN/LOCODE (type ${cds.typeCode}, qualifier ${cds.qualifier})`,
      );
    }
  }

  const storedType = String(declaration.goodsLocationTypeCode || "").trim().toUpperCase();
  const storedQual = String(declaration.goodsLocationQualifier || "").trim().toUpperCase();
  if (storedType && storedType !== cds.typeCode) {
    errors.push(`Goods location type must be ${cds.typeCode} for the selected location method (got ${storedType})`);
  }
  if (storedQual && storedQual !== cds.qualifier) {
    errors.push(`Goods location qualifier must be ${cds.qualifier} for the selected location method (got ${storedQual})`);
  }

  return errors;
}
