/**
 * Logging for API routes, with sensitive keys redacted before they reach stdout.
 *
 * Nothing here fixes an observed leak: the routes today log error *messages*,
 * not payloads, and a sweep of `console.*` in src/app/api found no MRN, EORI or
 * token being printed. This is a guardrail so that stays true — the objects
 * flowing through these routes (declaration payloads, HMRC responses, OAuth
 * token exchanges) are exactly the ones a future `console.log(body)` would spill
 * into Vercel's log drain.
 *
 * Redaction is by key name, recursive, and depth-limited. It is a safety net,
 * not a licence to log payloads.
 */

const SENSITIVE_KEY =
  /(token|secret|authorization|auth|password|passwd|credential|apikey|api_key|cookie|session|eori|mrn|bearer|signature)/i;

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;

function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (value === null || typeof value !== "object") return value;

  // Errors carry a message worth keeping and a stack worth dropping.
  if (value instanceof Error) return { name: value.name, message: value.message };

  if (seen.has(value)) return "[circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    const head = value.slice(0, MAX_ARRAY).map((entry) => redactValue(entry, depth + 1, seen));
    return value.length > MAX_ARRAY ? [...head, `[+${value.length - MAX_ARRAY} more]`] : head;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) =>
      SENSITIVE_KEY.test(key) ? [key, REDACTED] : [key, redactValue(entry, depth + 1, seen)],
    ),
  );
}

/** Exported for tests. Redacts by key name, recursively. */
export function redact(value: unknown): unknown {
  return redactValue(value, 0, new WeakSet<object>());
}

function emit(
  method: "error" | "warn" | "info",
  message: string,
  meta?: unknown,
): void {
  if (meta === undefined) {
    console[method](message);
    return;
  }
  console[method](message, redact(meta));
}

export const log = {
  error: (message: string, meta?: unknown) => emit("error", message, meta),
  warn: (message: string, meta?: unknown) => emit("warn", message, meta),
  info: (message: string, meta?: unknown) => emit("info", message, meta),
};
