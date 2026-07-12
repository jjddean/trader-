/**
 * UK Strategic Export Control List snapshot types and loader (R2 JSON).
 */

export interface ControlListChunk {
  chunkId: string;
  clausePath: string;
  text: string;
  pageStart: number;
  pageEnd: number;
}

export interface ControlListCrossRef {
  targetEntryCode: string;
  relationType: "see_also" | "specified_in";
}

export interface ControlListEntry {
  entryCode: string;
  entryType: "military" | "dual_use" | "firearms" | "radioactive";
  category: string;
  title: string;
  fullText: string;
  pageStart: number;
  pageEnd: number;
  chunks: ControlListChunk[];
  notes: string[];
  exclusions: string[];
  crossRefs: ControlListCrossRef[];
}

export interface ControlListSnapshot {
  version: string;
  sourceRef: string;
  govSourceUrl: string;
  effectiveDate: string;
  parsedAt: string;
  entryCount: number;
  entries: ControlListEntry[];
}

let cachedSnapshot: ControlListSnapshot | null = null;
let cachedUrl: string | null = null;

export async function loadControlListSnapshot(url: string): Promise<ControlListSnapshot> {
  if (cachedSnapshot && cachedUrl === url) return cachedSnapshot;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`Failed to load control list snapshot: ${res.status} ${res.statusText}`);
  }

  const snapshot = (await res.json()) as ControlListSnapshot;
  cachedSnapshot = snapshot;
  cachedUrl = url;
  return snapshot;
}

export function clearControlListCache(): void {
  cachedSnapshot = null;
  cachedUrl = null;
}

export function findEntry(snapshot: ControlListSnapshot, entryCode: string): ControlListEntry | undefined {
  const code = entryCode.toUpperCase();
  return snapshot.entries.find((e) => e.entryCode.toUpperCase() === code);
}
