import type { SanctionsEntity, SanctionsSnapshot } from "./snapshot";
import {
  bestNameSimilarity,
  canonicaliseCountry,
  canonicaliseDob,
  canonicaliseIdentifier,
  canonicaliseName,
  tokenOverlapScore,
} from "./canonicalise";
import { computeScreeningScore, thresholdBand, type ScoreBreakdown } from "./scoring";

export interface ScreenSubjectInput {
  subjectType: "exporter" | "consignee" | "end_user" | "intermediary" | "vessel";
  name: string;
  address?: string;
  country?: string;
  dob?: string;
  identifiers?: Array<{ type: string; value: string }>;
}

export interface ScreeningMatch {
  uniqueId: string;
  entity: SanctionsEntity;
  scoreBreakdown: ScoreBreakdown;
  band: ReturnType<typeof thresholdBand>;
  matchedName: string | null;
  matchedIdentifier: { type: string; value: string } | null;
  matchReason: string;
}

export interface SanctionsIndex {
  version: string;
  entities: SanctionsEntity[];
  identifierMap: Map<string, SanctionsEntity[]>;
}

export function buildSanctionsIndex(snapshot: SanctionsSnapshot): SanctionsIndex {
  const identifierMap = new Map<string, SanctionsEntity[]>();

  for (const entity of snapshot.entities) {
    for (const id of entity.identifiers) {
      const key = `${id.type}:${canonicaliseIdentifier(id.value)}`;
      const bucket = identifierMap.get(key) ?? [];
      bucket.push(entity);
      identifierMap.set(key, bucket);
    }
  }

  return {
    version: snapshot.version,
    entities: snapshot.entities,
    identifierMap,
  };
}

function addressScore(queryAddress: string | undefined, entity: SanctionsEntity): number {
  if (!queryAddress?.trim()) return 0;
  const query = canonicaliseName(queryAddress);
  let best = 0;
  for (const addr of entity.addresses) {
    const candidate = canonicaliseName(addr.lines.join(" "));
    best = Math.max(best, tokenOverlapScore(query, candidate));
  }
  return best;
}

function countryScore(queryCountry: string | undefined, entity: SanctionsEntity): number {
  const q = canonicaliseCountry(queryCountry);
  if (!q) return 0;
  for (const addr of entity.addresses) {
    const c = canonicaliseCountry(addr.country);
    if (c && c === q) return 1;
  }
  return 0;
}

function dobScore(queryDob: string | undefined, entity: SanctionsEntity): number {
  const q = canonicaliseDob(queryDob);
  if (!q || entity.dobs.length === 0) return 0;
  for (const d of entity.dobs) {
    const c = canonicaliseDob(d);
    if (c && c === q) return 1;
  }
  return 0;
}

function identifierScore(
  queryIds: ScreenSubjectInput["identifiers"],
  entity: SanctionsEntity,
): { score: number; exact: boolean; matched: { type: string; value: string } | null } {
  if (!queryIds?.length) return { score: 0, exact: false, matched: null };

  for (const q of queryIds) {
    const qNorm = canonicaliseIdentifier(q.value);
    for (const id of entity.identifiers) {
      if (id.type === q.type && canonicaliseIdentifier(id.value) === qNorm) {
        return { score: 1, exact: true, matched: id };
      }
    }
  }
  return { score: 0, exact: false, matched: null };
}

export function screenSubject(index: SanctionsIndex, subject: ScreenSubjectInput, limit = 5): ScreeningMatch[] {
  const allNames = (entity: SanctionsEntity) => [
    ...entity.names.map((n) => n.fullName),
    ...entity.nonLatinNames,
  ];

  const matches: ScreeningMatch[] = [];

  for (const entity of index.entities) {
    const names = allNames(entity);
    const nameSim = bestNameSimilarity(subject.name, names);
    const idResult = identifierScore(subject.identifiers, entity);
    const address = addressScore(subject.address, entity);
    const country = countryScore(subject.country, entity);
    const dob = dobScore(subject.dob, entity);

    const scoreBreakdown = computeScreeningScore({
      name: nameSim,
      address,
      country,
      dob,
      identifier: idResult.score,
      identifierExact: idResult.exact,
    });

    const band = thresholdBand(scoreBreakdown.total, scoreBreakdown.identifierExact);
    if (band.band === "ignore") continue;

    const matchedName =
      names.find((n) => bestNameSimilarity(subject.name, [n]) === nameSim) ?? null;

    matches.push({
      uniqueId: entity.uniqueId,
      entity,
      scoreBreakdown,
      band,
      matchedName,
      matchedIdentifier: idResult.matched,
      matchReason: idResult.exact
        ? `Exact ${idResult.matched?.type} identifier match`
        : `Name similarity ${Math.round(nameSim * 100)}%`,
    });
  }

  return matches.sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total).slice(0, limit);
}

export function screenParties(
  index: SanctionsIndex,
  subjects: ScreenSubjectInput[],
): Array<{ subject: ScreenSubjectInput; matches: ScreeningMatch[] }> {
  return subjects.map((subject) => ({
    subject,
    matches: screenSubject(index, subject),
  }));
}
