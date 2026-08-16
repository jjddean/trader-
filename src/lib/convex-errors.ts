import { ConvexError } from "convex/values";

/**
 * Shown whenever the failure was not a deliberate, user-facing one. Internal
 * faults (schema violations, bad IDs, thrown Errors, network stack traces) must
 * never reach the customer verbatim — Convex already redacts them in production,
 * and this keeps dev honest by redacting them here too.
 */
export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again — if it keeps happening, contact support.";

/**
 * An error whose message came from one of our own API routes and is already
 * safe to show. Convex errors arrive as ConvexError; these arrive as a plain
 * throw after `res.ok` fails, and without this marker they would be replaced by
 * the generic fallback — hiding messages the route wrote deliberately.
 */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface UserErrorData {
  kind: "user";
  code: string;
  message: string;
}

function userErrorData(err: unknown): UserErrorData | null {
  if (!(err instanceof ConvexError)) return null;
  const data: unknown = err.data;
  if (!data || typeof data !== "object") return null;
  const candidate = data as Partial<UserErrorData>;
  if (candidate.kind !== "user") return null;
  if (typeof candidate.code !== "string" || typeof candidate.message !== "string") return null;
  return candidate as UserErrorData;
}

/** Message safe to render to the customer. */
export function userMessageFromError(err: unknown, fallback = GENERIC_ERROR_MESSAGE): string {
  if (err instanceof ApiError && err.message.trim()) return err.message;
  return userErrorData(err)?.message ?? fallback;
}

/** Stable machine code for deliberate failures, so callers can branch on them. */
export function userErrorCode(err: unknown): string | null {
  return userErrorData(err)?.code ?? null;
}
