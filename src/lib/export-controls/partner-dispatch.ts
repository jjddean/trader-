/**
 * Outbound calls to a consultant partner's inbox.
 *
 * Only case metadata crosses this boundary — reference, status, timings and a
 * handoff path. No assessment, no products, no parties, no evidence, no notes.
 * The partner holds an inbox; the review stays here.
 */

import { sourceSlug, type ConsultantPartner } from "./partner-registry";
import {
  createPartnerSignatureHeaders,
  isAllowedPartnerUrl,
  PARTNER_RESPONSE_MAX_BYTES,
  readResponseBodyLimited,
} from "./partner-signature";

/** What a partner is told about a case. Deliberately small. */
export interface PartnerCasePayload {
  source: string;
  externalCaseId: string;
  reference: string;
  status: "received";
  priority?: string;
  /** Non-identifying one-liner, e.g. "Dual-use · destination TR". */
  subjectLabel?: string;
  dueAt?: string;
  expiresAt?: string;
  /** Where the partner asks for a one-time launch URL. */
  handoffPath: string;
  /** Legal capacity selected by the exporter for this review. */
  reviewRole: "adviser" | "applies_on_behalf" | "eor";
}

export interface PartnerDeliveryResult {
  ok: boolean;
  caseId?: string;
  error?: string;
}

const TIMEOUT_MS = Number(process.env.CONSULTANT_PARTNER_TIMEOUT_MS) || 15_000;

async function postToPartner(
  partner: ConsultantPartner,
  url: string,
  body: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown>; error?: string }> {
  if (!partner.outboundKey) {
    return { ok: false, status: 0, json: {}, error: "No outbound key configured for this partner" };
  }
  if (!isAllowedPartnerUrl(url)) {
    return { ok: false, status: 0, json: {}, error: "Partner endpoint is not an allowed URL" };
  }

  const rawBody = JSON.stringify(body);
  const canSign = Boolean(partner.outboundSigningKey && partner.keyId);
  if (!canSign) {
    return { ok: false, status: 0, json: {}, error: "Partner request signing is not configured" };
  }
  if (canSign && Buffer.byteLength(partner.outboundSigningKey!, "utf8") < 32) {
    return { ok: false, status: 0, json: {}, error: "Partner request signing is not configured" };
  }

  const signatureHeaders = canSign
    ? createPartnerSignatureHeaders({
        method: "POST",
        url,
        rawBody,
        signingKey: partner.outboundSigningKey!,
        keyId: partner.keyId!,
      })
    : {};
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${partner.outboundKey}`,
        ...signatureHeaders,
      },
      body: rawBody,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    });
    const responseText = await readResponseBodyLimited(response, PARTNER_RESPONSE_MAX_BYTES);
    if (responseText === null) {
      return { ok: false, status: response.status, json: {}, error: "Partner response was too large" };
    }
    let json: Record<string, unknown> = {};
    try {
      const parsed = responseText ? (JSON.parse(responseText) as unknown) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        json = parsed as Record<string, unknown>;
      }
    } catch {
      json = {};
    }
    return {
      ok: response.ok && response.status < 300,
      status: response.status,
      json,
      error: response.ok && response.status < 300 ? undefined : String(json.error ?? `HTTP ${response.status}`),
    };
  } catch (error: unknown) {
    return {
      ok: false,
      status: 0,
      json: {},
      error: error instanceof Error ? error.message : "Delivery failed",
    };
  }
}

/** Push a new case to the partner inbox. */
export async function deliverCaseToPartner(
  partner: ConsultantPartner,
  payload: PartnerCasePayload,
): Promise<PartnerDeliveryResult> {
  if (!partner.intakeUrl) {
    return { ok: false, error: "No intake URL configured for this partner" };
  }
  const result = await postToPartner(partner, partner.intakeUrl, payload);
  if (!result.ok) return { ok: false, error: result.error };
  const caseId = typeof result.json.caseId === "string" ? result.json.caseId : undefined;
  return { ok: true, caseId };
}

/**
 * Tell the partner a case changed state.
 *
 * Best-effort by design: the authority on whether a review may proceed is this
 * system, checked at handoff and again at completion. A failed status push
 * leaves the partner's inbox stale, not their consultant able to do something
 * they should not.
 */
export async function pushCaseStatusToPartner(
  partner: ConsultantPartner,
  externalCaseId: string,
  status: "in_review" | "completed" | "blocked" | "revoked" | "expired",
): Promise<PartnerDeliveryResult> {
  if (!partner.intakeUrl) {
    return { ok: false, error: "No intake URL configured for this partner" };
  }
  const statusUrl = partner.intakeUrl.replace(/\/$/, "") + "/status";
  const result = await postToPartner(partner, statusUrl, {
    source: sourceSlug(),
    externalCaseId,
    status,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * A one-line description of the case with no commercially sensitive detail.
 *
 * Shown in the partner's inbox so a consultant can triage. Destination country
 * and control status only — never the goods, the parties or the values.
 */
export function buildSubjectLabel(input: {
  destinationCountry?: string;
  productCount: number;
  controlled: boolean;
}): string {
  const parts: string[] = [];
  parts.push(input.controlled ? "Controlled goods" : "Export assessment");
  parts.push(`${input.productCount} ${input.productCount === 1 ? "item" : "items"}`);
  if (input.destinationCountry) parts.push(`destination ${input.destinationCountry}`);
  return parts.join(" · ");
}
