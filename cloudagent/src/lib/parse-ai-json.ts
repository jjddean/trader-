/** Parse JSON from Cloudflare Workers AI chat completion shapes. */
function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function parseWorkersAiJson(response: unknown): unknown {
  if (typeof response === "string") {
    return JSON.parse(stripMarkdownJsonFence(response));
  }
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (typeof record.response === "string") {
      return JSON.parse(stripMarkdownJsonFence(record.response));
    }
    const choices = record.choices as Array<{ message?: { content?: unknown } }> | undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(stripMarkdownJsonFence(content));
    }
    if (content && typeof content === "object") {
      return content;
    }
  }
  return response;
}
