import Groq from "groq-sdk";
import type { ExportProduct } from "./extraction";
import type { RetrievalHit } from "./retrieval";
import type { PredicateHit } from "./predicates/types";
import { computeClassificationConfidence } from "./confidence";

export const EXPORT_CLASSIFICATION_PROMPT_VERSION = "export-classify-v1";

export interface ControlEntryCandidate {
  entryCode: string;
  clausePath: string;
  title: string;
  citation: string;
  rationale: string;
  missingDiscriminators: string[];
  band: "matches" | "possible_matches" | "insufficient_evidence";
}

export interface ClassificationResult {
  matches: ControlEntryCandidate[];
  possible_matches: ControlEntryCandidate[];
  insufficient_evidence: ControlEntryCandidate[];
  predicateHits: PredicateHit[];
  confidence: number;
  requiresReview: boolean;
  controlListVersion: string;
  promptVersion: string;
  modelVersion: string;
  retrievalHits: RetrievalHit[];
  disclaimer: string;
}

export const EXPORT_CLASSIFY_SYSTEM_PROMPT = `You map product technical facts to UK export control list candidate entries.
You are decision-support only — never claim legal certainty or that goods are uncontrolled.
Output valid JSON only:
{
  "matches": [{ "entry_code": string, "clause_path": string, "title": string, "citation": string, "rationale": string, "missing_discriminators": [string] }],
  "possible_matches": [{ same shape }],
  "insufficient_evidence": [{ same shape }]
}
Rules:
- Use UK term "control entry" / "rating" — never "ECCN".
- Cite entry_code from the candidate list only.
- citation must quote or paraphrase the supplied control-list chunk text.
- List missing_discriminators when threshold facts are absent (e.g. key length, frequency, power).
- matches = strong alignment with supplied facts; possible_matches = plausible but incomplete; insufficient_evidence = cannot assess.
- Never place an entry in matches if predicate results show threshold_not_met unless you explain why human review is still needed.
- Do not invent entries not in the candidate list.`;

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function parseCandidate(value: unknown, band: ControlEntryCandidate["band"]): ControlEntryCandidate | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  const entryCode = asString(c.entry_code ?? c.entryCode);
  const title = asString(c.title);
  const rationale = asString(c.rationale);
  if (!entryCode || !title || !rationale) return null;

  const missingRaw = c.missing_discriminators ?? c.missingDiscriminators;
  const missing = Array.isArray(missingRaw) ? missingRaw.map(String) : [];

  return {
    entryCode: entryCode.toUpperCase(),
    clausePath: asString(c.clause_path ?? c.clausePath) ?? "full",
    title,
    citation: asString(c.citation) ?? "",
    rationale,
    missingDiscriminators: missing,
    band,
  };
}

export function validateClassificationOutput(raw: unknown): Pick<ClassificationResult, "matches" | "possible_matches" | "insufficient_evidence"> {
  const root = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const parseBand = (key: string, band: ControlEntryCandidate["band"]) => {
    const arr = Array.isArray(root[key]) ? root[key] : [];
    return arr.map((item) => parseCandidate(item, band)).filter(Boolean) as ControlEntryCandidate[];
  };

  return {
    matches: parseBand("matches", "matches"),
    possible_matches: parseBand("possible_matches", "possible_matches"),
    insufficient_evidence: parseBand("insufficient_evidence", "insufficient_evidence"),
  };
}

export async function classifyProductAgainstControlList(input: {
  product: ExportProduct;
  retrievalHits: RetrievalHit[];
  predicateHits: PredicateHit[];
  controlListVersion: string;
  missingFields?: string[];
}): Promise<ClassificationResult> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error("Groq API Key not configured");

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const groq = new Groq({ apiKey: groqApiKey });

  const candidatePayload = input.retrievalHits.map((h) => ({
    entry_code: h.entryCode,
    clause_path: h.clausePath,
    title: h.title,
    chunk_text: h.chunkText,
    page: h.pageStart,
    retrieval_score: h.score,
    matched_terms: h.matchedTerms,
  }));

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: EXPORT_CLASSIFY_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          product: input.product,
          predicate_results: input.predicateHits,
          candidate_entries: candidatePayload,
          missing_fields: input.missingFields ?? [],
        }),
      },
    ],
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content || "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseContent);
  } catch {
    throw new Error("Failed to parse classification model response");
  }

  const bands = validateClassificationOutput(parsed);
  const confidence = computeClassificationConfidence({
    product: input.product,
    predicateHits: input.predicateHits,
    missingFields: input.missingFields ?? [],
  });

  const hasMatch =
    bands.matches.length > 0 ||
    bands.possible_matches.length > 0 ||
    input.predicateHits.some((h) => h.outcome === "threshold_met");

  return {
    ...bands,
    predicateHits: input.predicateHits,
    confidence,
    requiresReview: true,
    controlListVersion: input.controlListVersion,
    promptVersion: EXPORT_CLASSIFICATION_PROMPT_VERSION,
    modelVersion: model,
    retrievalHits: input.retrievalHits,
    disclaimer: hasMatch
      ? "Candidate control entries identified — human review required before any export decision."
      : "No strong control entry match from available facts — human review still required in Phase 3.",
  };
}
