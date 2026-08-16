import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export function normalizeEmail(value: string | null | undefined): string | undefined {
  const trimmed = String(value ?? "")
    .trim()
    .toLowerCase();
  return trimmed || undefined;
}

export interface ResolvedEmail {
  email: string;
  /**
   * `jwt` is trustworthy — Clerk signed it.
   * `user_row` came from users.syncUser, whose email argument is supplied by the
   * client, so it must not be treated as proof of ownership.
   */
  source: "jwt" | "user_row";
  /** From the email_verified claim. `null` when the claim is absent or unparseable. */
  verified: boolean | null;
}

/** Clerk renders `{{user.email_verified}}` as a bool on some plans and a string on others. */
function readVerifiedClaim(identity: Record<string, unknown>): boolean | null {
  const raw = identity.email_verified ?? identity.emailVerified;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const t = raw.trim().toLowerCase();
    if (t === "true") return true;
    if (t === "false") return false;
  }
  return null;
}

/**
 * The signed-in user's own email — never a value the client typed into a form.
 * Portal binding (clients.portalEmail) must be keyed off this, otherwise a user
 * can claim someone else's address.
 *
 * Prefers the JWT `email` claim. The users-row fallback exists only for sessions
 * issued before the claim was added to the Clerk `convex` JWT template; it is
 * client-asserted and logs on every use so the remaining reliance is visible.
 */
export async function resolveSignedInEmail(
  ctx: Ctx,
  identity: { subject: string; email?: string | null },
): Promise<ResolvedEmail | null> {
  const claims = identity as unknown as Record<string, unknown>;
  const fromJwt = normalizeEmail(typeof identity.email === "string" ? identity.email : undefined);
  if (fromJwt) {
    return { email: fromJwt, source: "jwt", verified: readVerifiedClaim(claims) };
  }

  const dbUser = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();
  const fromRow = normalizeEmail(typeof dbUser?.email === "string" ? dbUser.email : undefined);
  if (!fromRow) return null;

  console.warn(
    "[auth] JWT carried no email claim; falling back to client-asserted users.email",
    { clerkId: identity.subject },
  );
  return { email: fromRow, source: "user_row", verified: null };
}
