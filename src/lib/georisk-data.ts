export interface GeoRiskPort {
  id: number;
  name: string;
  unlocode: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface GeoRiskLane {
  id: number;
  origin_port_id: number;
  destination_port_id: number;
  mode: string;
  origin_port: GeoRiskPort;
  destination_port: GeoRiskPort;
}

export interface GeoRiskScore {
  entityType: string;
  entityId: number;
  score: number;
  status: string;
  breakdown: Record<string, unknown>;
}

export function normalizeGeoRiskScore(value: Record<string, unknown>): GeoRiskScore {
  return {
    entityType: String(value.entityType ?? value.entity_type ?? ""),
    entityId: Number(value.entityId ?? value.entity_id ?? 0),
    score: Number(value.score ?? 0),
    status: String(value.status ?? ""),
    breakdown:
      typeof value.breakdown === "object" && value.breakdown !== null
        ? (value.breakdown as Record<string, unknown>)
        : {},
  };
}

export function findGeoRiskLane(
  lanes: GeoRiskLane[],
  originUNLocode: string,
  destinationUNLocode: string,
) {
  const origin = originUNLocode.toUpperCase();
  const destination = destinationUNLocode.toUpperCase();
  return lanes.find(
    (lane) =>
      lane.origin_port?.unlocode?.toUpperCase() === origin &&
      lane.destination_port?.unlocode?.toUpperCase() === destination,
  );
}
