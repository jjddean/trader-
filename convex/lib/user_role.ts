import type { MutationCtx, QueryCtx } from "../_generated/server";
import { forbiddenError, unauthenticatedError } from "./user_errors";

type AuthCtx = Pick<QueryCtx, "auth" | "db"> | Pick<MutationCtx, "auth" | "db">;

export function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Admin if JWT, Convex users row, or ADMIN_EMAILS bootstrap list says so. */
export function resolveUserRole(
  jwtRole: string | undefined,
  dbRole: string | undefined,
  email?: string,
): string | undefined {
  const normalizedEmail = email?.trim().toLowerCase();
  const bootstrapAdmin =
    Boolean(normalizedEmail) && parseAdminEmails().includes(normalizedEmail!);

  if (jwtRole === "admin" || dbRole === "admin" || bootstrapAdmin) {
    return "admin";
  }

  return jwtRole ?? dbRole;
}

export async function getCurrentUserRole(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const dbUser = await ctx.db
    .query("users")
    .withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject))
    .unique();

  const email =
    (typeof dbUser?.email === "string" ? dbUser.email : undefined) ??
    (typeof identity.email === "string" ? identity.email : undefined);

  const role = resolveUserRole(
    identity.role as string | undefined,
    typeof dbUser?.role === "string" ? dbUser.role : undefined,
    email,
  );

  return { identity, dbUser, role, email };
}

/**
 * Thrown as ConvexError, not Error, on purpose: a Convex production deployment
 * redacts a plain `Error` to the string "Server Error" before it reaches the
 * browser (see lib/user_errors.ts). A denied admin then reached the client as an
 * opaque crash — the global error boundary — instead of a readable refusal.
 */
export async function requireAdmin(ctx: AuthCtx): Promise<void> {
  const current = await getCurrentUserRole(ctx);
  if (!current) throw unauthenticatedError();
  if (current.role !== "admin") throw forbiddenError();
}
