import { ConvexError } from "convex/values";

/**
 * Deliberate, user-facing failures.
 *
 * Convex PRODUCTION deployments redact any thrown `Error` down to the string
 * "Server Error" before it reaches the browser — message and stack are stripped.
 * Only `ConvexError` payloads survive. So every guard whose message the user is
 * meant to read must be thrown as a `ConvexError`, or it becomes an opaque crash
 * in production while looking fine in dev.
 *
 * Anything thrown as a plain `Error` stays redacted on purpose: those are
 * internal faults and must not leak to customers.
 */
export interface UserErrorData {
  [key: string]: string;
  kind: "user";
  /** Stable machine code — safe to branch on in the UI. */
  code: string;
  /** Message shown to the customer. No internal detail, no IDs, no stack. */
  message: string;
}

export function userError(code: string, message: string): ConvexError<UserErrorData> {
  return new ConvexError({ kind: "user" as const, code, message });
}

export function unauthenticatedError(): ConvexError<UserErrorData> {
  return userError("unauthenticated", "Your session has expired. Sign in again to continue.");
}

/** Authenticated but not allowed. Never says why — that would confirm the record exists. */
export function forbiddenError(): ConvexError<UserErrorData> {
  return userError("forbidden", "You do not have access to this record.");
}
