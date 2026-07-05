/**
 * UK Sanctions List snapshot types and loader (R2 JSON).
 * Screening engine (Phase 4) builds an in-memory index from this shape.
 */

export interface SanctionsName {
  nameType: string;
  fullName: string;
  aliasStrength?: string;
  nameParts: Record<string, string>;
}

export interface SanctionsIdentifier {
  type: string;
  value: string;
  extra?: string;
}

export interface SanctionsAddress {
  lines: string[];
  country?: string;
  postalCode?: string;
}

export interface SanctionsEntity {
  uniqueId: string;
  ofsiGroupId?: string;
  unReferenceNumber?: string;
  groupType: "individual" | "entity" | "ship";
  regimeName: string;
  designationSource?: string;
  sanctionsImposed?: string;
  measures: string[];
  names: SanctionsName[];
  nonLatinNames: string[];
  addresses: SanctionsAddress[];
  dobs: string[];
  identifiers: SanctionsIdentifier[];
  statementOfReasons?: string;
  otherInformation?: string;
  lastUpdated: string | null;
  dateDesignated: string | null;
}

export interface SanctionsSnapshot {
  version: string;
  sourceRef: string;
  sourceUrl: string;
  govPublicationUrl: string;
  dateGenerated: string;
  sourceHash?: string;
  parsedAt?: string;
  entityCount: number;
  entities: SanctionsEntity[];
}

/** Load sanctions snapshot JSON from a URL (R2 public URL or CDN path). */
export async function loadSanctionsSnapshot(url: string): Promise<SanctionsSnapshot> {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Failed to load sanctions snapshot: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as SanctionsSnapshot;
}

/** All searchable name strings for an entity (primary + aliases + non-Latin). */
export function entitySearchNames(entity: SanctionsEntity): string[] {
  const names = entity.names.map((n) => n.fullName);
  return [...new Set([...names, ...entity.nonLatinNames].filter(Boolean))];
}
