import { randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";

/** Reuse an inbound correlation id when present so one id spans the whole call chain. */
export function correlationIdFrom(request: Request): string {
  const inbound = request.headers.get(CORRELATION_HEADER)?.trim();
  if (inbound && /^[A-Za-z0-9._:-]{8,128}$/.test(inbound)) return inbound;
  return randomUUID();
}

export interface OperationContext {
  correlationId: string;
  operation: string;
  userId?: string | null;
  orgId?: string | null;
  declarationId?: string | null;
  clientId?: string | null;
}

/**
 * One structured line per important failure, carrying the full trail:
 * correlation id → user → organisation → declaration/client → operation → error.
 * Convex and Vercel both capture stdout, so this is greppable without extra tooling.
 */
export function logOperationFailure(ctx: OperationContext, error: unknown, extra?: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      level: "error",
      correlationId: ctx.correlationId,
      operation: ctx.operation,
      userId: ctx.userId ?? null,
      orgId: ctx.orgId ?? null,
      declarationId: ctx.declarationId ?? null,
      clientId: ctx.clientId ?? null,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...extra,
    }),
  );
}

/** Attach the correlation id to a response so a customer can quote it to support. */
export function withCorrelation(response: Response, correlationId: string): Response {
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}
