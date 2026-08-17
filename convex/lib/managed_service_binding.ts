/**
 * Which existing client row (if any) a Managed Service sign-up may take over.
 *
 * Pure decision logic so the rules are testable without a deployment — same
 * pattern as portal_document_policy.ts.
 *
 * Two invariants:
 *  1. A client owned by a broker's Clerk org is never pulled into the managed
 *     org, whether it is matched by Clerk id or by email.
 *  2. A row matched by the caller's OWN Clerk email may always be re-bound to
 *     the caller. The email came from Clerk, not from the submitted form, so a
 *     match proves the caller controls that address — it is the same person
 *     signing up again on a new Clerk account, or returning after portal access
 *     was revoked. Refusing here left them permanently locked out.
 */
export type ManagedBindingConflict =
  | "portal_linked_to_broker"
  | "email_belongs_to_broker_client";

export interface ManagedBindingCandidate<Id> {
  _id: Id;
  orgId?: string;
  /** Set by completeManagedService. True means this row is ours, not a broker's. */
  managedService?: boolean;
}

/**
 * A candidate belongs to a broker only if it carries some other org AND was not
 * created by Managed Service.
 *
 * Comparing orgId to the configured managed org is not sufficient on its own:
 * FREIGHTCODE_MANAGED_ORG_ID changed on production on 2026-08-17, and every
 * client created under the previous value immediately looked broker-owned.
 * Existing customers were told their address "is already registered as a
 * broker's client" and sent to support. The flag makes a row's origin a fact
 * about the row rather than a function of current configuration.
 */
function isBrokerOwned<Id>(
  candidate: ManagedBindingCandidate<Id> | null | undefined,
  managedOrgId: string,
): boolean {
  if (!candidate) return false;
  if (candidate.managedService) return false;
  return Boolean(candidate.orgId) && candidate.orgId !== managedOrgId;
}

export interface ManagedBindingInput<Id> {
  managedOrgId: string;
  /** Client already bound to this Clerk user, by clients.portalClerkId. */
  byClerk: ManagedBindingCandidate<Id> | null | undefined;
  /** Client bound to the caller's Clerk-verified email, by clients.portalEmail. */
  byEmail: ManagedBindingCandidate<Id> | null | undefined;
}

export function managedServiceBindingConflict<Id>(
  input: ManagedBindingInput<Id>,
): ManagedBindingConflict | null {
  const { managedOrgId, byClerk, byEmail } = input;

  if (isBrokerOwned(byClerk, managedOrgId)) {
    return "portal_linked_to_broker";
  }

  if (isBrokerOwned(byEmail, managedOrgId) && (!byClerk || byClerk._id !== byEmail!._id)) {
    return "email_belongs_to_broker_client";
  }

  return null;
}

/** The client row to update, or null to create a new one. Call only when there is no conflict. */
export function managedServiceClientToReuse<Id, T extends ManagedBindingCandidate<Id>>(
  byClerk: T | null | undefined,
  byEmail: T | null | undefined,
): T | null {
  return byClerk ?? byEmail ?? null;
}
