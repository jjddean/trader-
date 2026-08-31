export function sentryInitOptions(kind: "client" | "server") {
  const dsn =
    kind === "client"
      ? process.env.NEXT_PUBLIC_SENTRY_DSN
      : process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  };
}
