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

  if (byClerk && byClerk.orgId && byClerk.orgId !== managedOrgId) {
    return "portal_linked_to_broker";
  }

  if (
    byEmail &&
    byEmail.orgId &&
    byEmail.orgId !== managedOrgId &&
    (!byClerk || byClerk._id !== byEmail._id)
  ) {
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
