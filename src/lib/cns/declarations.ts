/**
 * CNS declaration transport — submit, amend, cancel.
 *
 * The canonical CDS XML is built by the existing wco-mapper/h1-xml-renderer
 * pipeline. This module only changes how that payload reaches CDS: through the
 * CSP gateway with Basic auth and a badge, instead of direct HMRC OAuth.
 */

import { fetchCns, readCspId, type CnsResponse } from "./client";
import type { CnsConfig } from "./config";
import { cnsTransportFailure, normalizeCnsError, type NormalizedCnsError } from "./errors";
import { assertInventoryFieldsPresent, assertNoGoodsPresentation } from "./inventory-xml";

export type CnsOperation = "create" | "amend" | "cancel";

/** Declaration API v1.0.3 §5 — relative paths. */
const ENDPOINTS: Record<CnsOperation, string> = {
  create: "/cds/customs/declarations/",
  cancel: "/cds/customs/declarations/cancellation-requests",
  amend: "/cds/customs/declarations/amend",
};

export function cnsEndpointPath(operation: CnsOperation): string {
  return ENDPOINTS[operation];
}

export interface CnsSubmitInput {
  operation: CnsOperation;
  /** Canonical CDS XML from the existing builder. Never rebuilt here. */
  xmlPayload: string;
  /**
   * The UCN for this declaration. Required for create; carried on amend so the
   * inventory assertions still apply to a nil/blank retrigger.
   */
  ucn?: string;
  /** Gov-* headers forwarded unaltered from the browser request. */
  forwardedGovHeaders?: Record<string, string>;
  signal?: AbortSignal;
}

export type CnsSubmitResult =
  | {
      status: "accepted";
      /** HTTP 202 only. Never means CDS acceptance, MRN issue, or clearance. */
      httpStatus: number;
      /**
       * Transport correlation for the initial request and any inventory
       * pre-check failure. Store it — but the LRN remains the permanent key.
       */
      cspId: string | null;
    }
  | {
      status: "failed";
      error: NormalizedCnsError;
    };

/**
 * Local invariants enforced before a single byte goes to CNS. Failing here costs
 * nothing; failing at the CSP costs an inventory pre-check and an operator
 * round-trip.
 */
export function assertInventoryPreconditions(
  config: CnsConfig,
  input: CnsSubmitInput,
): void {
  assertNoGoodsPresentation(input.xmlPayload);

  // A cancellation carries no goods shipment, so the inventory reference is not
  // expected on it. Create and amend both must carry it.
  if (input.operation !== "cancel") {
    assertInventoryFieldsPresent(input.xmlPayload, input.ucn, config.goodsLocationCode);
  }
}

/**
 * Send a declaration operation to CNS.
 *
 * Returns a discriminated result rather than throwing on a CSP error, because
 * every failure class has a different persistence obligation (spec §6.4): a 400
 * must persist the errorDetail, a 429 must leave the attempt pending, and a 5xx
 * must mark the outcome unknown rather than failed.
 */
export async function sendCnsDeclaration(
  config: CnsConfig,
  input: CnsSubmitInput,
): Promise<CnsSubmitResult> {
  assertInventoryPreconditions(config, input);

  let response: CnsResponse;
  try {
    response = await fetchCns(config, {
      method: "POST",
      path: cnsEndpointPath(input.operation),
      kind: "declaration",
      body: input.xmlPayload,
      contentType: "application/xml; charset=utf-8",
      forwardedGovHeaders: input.forwardedGovHeaders,
      signal: input.signal,
    });
  } catch (error) {
    // No HTTP response at all. CNS may still have received and forwarded the
    // request — never record this as a rejection.
    return { status: "failed", error: cnsTransportFailure(error) };
  }

  // Declaration API v1.0.3, Success Response: 202 confirms only that CNS
  // completed basic validation/authentication and received the request. It does
  // NOT confirm inventory linking, forwarding to HMRC, legal acceptance, duty
  // calculation or clearance. Everything downstream arrives asynchronously on
  // the notification topic.
  //
  // Note the divergence from the direct HMRC path: CNS returns X-CSP-ID here and
  // never X-Conversation-ID. The submit route's HMRC branch treats a missing
  // X-Conversation-ID as a hard failure — that gate must not be applied here.
  if (response.status === 202) {
    return {
      status: "accepted",
      httpStatus: response.status,
      cspId: readCspId(response.headers),
    };
  }

  return {
    status: "failed",
    error: normalizeCnsError(response.status, response.body),
  };
}

/**
 * Nil/blank amendment — retriggers inventory linking after the CNS inventory
 * record has been corrected (Declaration API v1.0.3, Example Nil/Blank
 * Amendment).
 *
 * ChangeReasonCode 31 makes the amendment pass through the CSP without inventory
 * pre-checks. The message must contain NO actual declaration change: it "amends"
 * the inventory reference to the value it already holds.
 *
 * Deliberately not exposed as an automatic response to CDS20001. Spec §7.5
 * requires operator confirmation that the inventory record is now correct, and
 * an audit trail of who asked for the retrigger and why.
 */
export const NIL_AMENDMENT_CHANGE_REASON_CODE = "31";

export interface NilAmendmentRequest {
  /** The original create LRN — never a freshly minted one. */
  lrn: string;
  mrn: string;
  /** The inventory reference as originally declared. */
  ucn: string;
  /** Who asked for the retrigger, and why. Persisted for audit (§7.5). */
  requestedBy: string;
  reason: string;
}

export function assertNilAmendmentRequest(request: NilAmendmentRequest): void {
  const missing: string[] = [];
  if (!request.lrn?.trim()) missing.push("original LRN");
  if (!request.mrn?.trim()) missing.push("MRN");
  if (!request.ucn?.trim()) missing.push("UCN");
  if (!request.requestedBy?.trim()) missing.push("requesting operator");
  if (!request.reason?.trim()) missing.push("reason");
  if (missing.length > 0) {
    throw new Error(`Nil/blank amendment requires: ${missing.join(", ")}.`);
  }
}
