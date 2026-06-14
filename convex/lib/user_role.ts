import type { MutationCtx, QueryCtx } from "../_generated/server";

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

export async function requireAdmin(ctx: AuthCtx): Promise<void> {
  const current = await getCurrentUserRole(ctx);
  if (!current || current.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
}
