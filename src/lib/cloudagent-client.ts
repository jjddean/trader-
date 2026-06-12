export function cloudagentBaseUrl(): string {
  return (process.env.AGENT_URL || process.env.CLOUDAGENT_URL || "").trim().replace(/\/$/, "");
}

export function cloudagentConfigured(): boolean {
  return cloudagentBaseUrl().length > 0;
}

export async function postCloudagent<T>(
  path: string,
  body: unknown,
  options?: { timeoutMs?: number },
): Promise<T> {
  const base = cloudagentBaseUrl();
  if (!base) {
    throw new Error("AGENT_URL is not configured");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const timeoutMs = options?.timeoutMs ?? 30_000;
  const signal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  const response = await fetch(`${base}${normalizedPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Cloudagent ${response.status}: ${errBody.slice(0, 300) || response.statusText}`);
  }

  return response.json() as Promise<T>;
}
