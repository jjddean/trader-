/** Parse JSON from Cloudflare Workers AI chat completion shapes. */
function stripMarkdownJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function firstJsonValue(text: string): string {
  const stripped = stripMarkdownJsonFence(text);
  const start = stripped.search(/[\[{]/);
  if (start === -1) return stripped;

  const open = stripped[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < stripped.length; i += 1) {
    const char = stripped[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === open) depth += 1;
    if (char === close) depth -= 1;
    if (depth === 0) return stripped.slice(start, i + 1);
  }

  return stripped.slice(start);
}

export function parseWorkersAiJson(response: unknown): unknown {
  if (typeof response === "string") {
    return JSON.parse(firstJsonValue(response));
  }
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    if (typeof record.response === "string") {
      return JSON.parse(firstJsonValue(record.response));
    }
    const choices = record.choices as Array<{ message?: { content?: unknown } }> | undefined;
    const content = choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return JSON.parse(firstJsonValue(content));
    }
    if (content && typeof content === "object") {
      return content;
    }
  }
  return response;
}
