/**
 * DE 5/23 — two mutually exclusive XML modes (never combine).
 *
 * PORT:   GoodsLocation/Name + GoodsLocation/ID only — no L110, no Address/410.
 * ADDRESS: not implemented (requires cited type/qualifier mapping).
 */

export type GoodsLocationKind = "port" | "address";

export const GOODS_LOCATION_KIND_OPTIONS: ReadonlyArray<{
  value: GoodsLocationKind;
  label: string;
  description: string;
}> = [
  {
    value: "port",
    label: "Port / airport",
    description: "Appendix 16 port code — XML uses Name + ID only.",
  },
  {
    value: "address",
    label: "Address-based location",
    description: "Not available yet — requires separate CDS mapping.",
  },
] as const;

/** Legacy Convex value → current kind. */
const LEGACY_PORT_KIND = "port_unlocode";

/**
 * Appendix 16 port rows where Name ≠ ID (project evidence + archive XML).
 * Key = GoodsLocation/ID, value = GoodsLocation/Name.
 */
export const PORT_LOCATION_NAME_BY_ID: Readonly<Record<string, string>> = {
  GBAUFXTFXTGW: "GBWLAFXTFXTGW",
};

export interface ResolvedGoodsLocationXml {
  Name: string;
  ID: string;
  TypeCode: string;
  Address: { TypeCode: string; CountryCode: string };
}

export function normalizeGoodsLocationKind(value: unknown): GoodsLocationKind | "" {
  const raw = String(value || "").trim();
  if (raw === "port" || raw === LEGACY_PORT_KIND) return "port";
  if (raw === "address") return "address";
  return "";
}

export function inferGoodsLocationKind(declaration: {
  goodsLocationKind?: unknown;
}): GoodsLocationKind | "" {
  return normalizeGoodsLocationKind(declaration.goodsLocationKind);
}

/** PORT mode — Name + ID only. */
export function resolvePortGoodsLocation(locationId: string): ResolvedGoodsLocationXml | null {
  const id = locationId.trim().toUpperCase();
  const name = PORT_LOCATION_NAME_BY_ID[id];
  if (!name) return null;
  return {
    Name: name,
    ID: id,
    TypeCode: "",
    Address: { TypeCode: "", CountryCode: "" },
  };
}

export function resolveGoodsLocationForXml(declaration: {
  locationId?: unknown;
  goodsLocationKind?: unknown;
}): ResolvedGoodsLocationXml {
  const kind = inferGoodsLocationKind(declaration);
  const locationId = String(declaration.locationId || "").trim().toUpperCase();

  if (kind === "port") {
    const port = resolvePortGoodsLocation(locationId);
    if (port) return port;
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
    errors.push("Address-based goods location is not configured — use Port for this lane");
    return errors;
  }

  if (kind === "port" && !PORT_LOCATION_NAME_BY_ID[locationId]) {
    errors.push(
      `Unknown port location ID "${locationId}" — no Name mapping (DE 5/23). Known: ${Object.keys(PORT_LOCATION_NAME_BY_ID).join(", ")}`,
    );
  }

  return errors;
}
