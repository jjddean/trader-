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

export interface ControlListAdditionalOccurrence {
  title: string;
  fullText: string;
  pageStart: number;
  pageEnd: number;
  notes: string[];
  exclusions: string[];
  crossRefs: ControlListCrossRef[];
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
  additionalOccurrences?: ControlListAdditionalOccurrence[];
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

export function canonicalControlListEntries(
  entries: ControlListEntry[],
): ControlListEntry[] {
  const byCode = new Map<string, ControlListEntry[]>();

  for (const entry of entries) {
    const code = entry.entryCode.toUpperCase();
    const occurrences = byCode.get(code) ?? [];
    occurrences.push(entry);
    byCode.set(code, occurrences);
  }

  return Array.from(byCode.values(), (occurrences) => {
    const primary = occurrences.reduce((current, candidate) =>
      candidate.fullText.trim().length > current.fullText.trim().length
        ? candidate
        : current,
    );
    const additionalOccurrences = occurrences.flatMap((entry) => [
      ...(entry === primary
        ? []
        : [
            {
              title: entry.title,
              fullText: entry.fullText,
              pageStart: entry.pageStart,
              pageEnd: entry.pageEnd,
              notes: entry.notes,
              exclusions: entry.exclusions,
              crossRefs: entry.crossRefs,
            },
          ]),
      ...(entry.additionalOccurrences ?? []),
    ]);

    return {
      ...primary,
      additionalOccurrences,
    };
  });
}
export function findEntry(snapshot: ControlListSnapshot, entryCode: string): ControlListEntry | undefined {
  const code = entryCode.toUpperCase();
  return canonicalControlListEntries(snapshot.entries).find(
    (entry) => entry.entryCode.toUpperCase() === code,
  );
}
