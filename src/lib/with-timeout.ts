/**
 * Rejects if a promise has not settled within `ms`.
 *
 * Convex mutations are awaited behind disabled submit buttons. A `catch` only
 * runs when the promise *rejects* — if it never settles (Convex unreachable, or
 * the Clerk JWT fetch hanging) the button stays disabled forever and the
 * customer gets no message and no way to retry. Observed on the broker
 * onboarding form when Clerk's `/tokens/convex` request failed.
 */
export class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = DEFAULT_MUTATION_TIMEOUT_MS,
  message = "This is taking longer than expected. Check your connection and try again.",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
