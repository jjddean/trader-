/**
 * Shared resolution for follow-up operations (amend, cancel).
 *
 * Two rules apply to both, and getting either wrong is silent until it is very
 * expensive:
 *
 *  1. The route is the one the declaration was CREATED on. Never recomputed from
 *     current form state (spec §5.2).
 *  2. The FunctionalReferenceID is the ORIGINAL create LRN. Both source specs
 *     state it does not change for amendment or cancellation, and on CNS it is
 *     the only key that can correlate an inventory pre-check rejection — those
 *     notifications carry no ConversationID and a blank MRN.
 */

import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { readCnsConfig, type CnsConfig } from "./config";
import { transportForFollowUp, type SubmissionTransport } from "./routing";

export interface FollowUpContext {
  transport: SubmissionTransport;
  /** Original create LRN. Null when no create attempt was recorded. */
  createLrn: string | null;
  cnsUcn?: string;
  config: CnsConfig;
}

export async function resolveFollowUpContext(
  convex: ConvexHttpClient,
  declarationId: Id<"declarations">,
): Promise<FollowUpContext> {
  const [routingContext, createLrn] = await Promise.all([
    convex.query(api.cns.getRoutingContext, { declarationId }),
    convex.query(api.cns.getCreateLrn, { declarationId }),
  ]);

  return {
    transport: transportForFollowUp(routingContext.storedTransport),
    createLrn,
    cnsUcn: routingContext.cnsUcn,
    config: readCnsConfig(),
  };
}

/**
 * The FunctionalReferenceID to put on a follow-up message.
 *
 * On the CNS route this MUST be the original create LRN; if it cannot be found
 * the operation is refused rather than sent under a fabricated reference, which
 * would produce notifications that can never be correlated.
 *
 * On the direct HMRC route the existing behaviour is preserved: those routes
 * mint their own `AM-`/`CX-` references and correlate via X-Conversation-ID.
 * Changing that is a separate decision with TDR evidence implications.
 */
export function resolveFollowUpLrn(
  context: FollowUpContext,
  fallbackLrn: string,
  operation: "amend" | "cancel",
): string {
  if (context.transport !== "cns_inventory") return fallbackLrn;

  if (!context.createLrn) {
    throw new FollowUpLrnUnavailableError(
      `Cannot ${operation} through CNS: the original declaration LRN could not be found. CNS requires the create LRN on amendments and cancellations, and it is the only key that can correlate an inventory rejection back to this declaration.`,
    );
  }
  return context.createLrn;
}

export class FollowUpLrnUnavailableError extends Error {}

/** Gov-* headers forwarded unaltered from the originating browser request. */
export function collectGovHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith("gov-")) headers[name] = value;
  });
  return headers;
}
