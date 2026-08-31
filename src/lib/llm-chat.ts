/**
 * Chat LLM provider selection.
 * Production → OpenAI (gpt-4o-mini by default).
 * Non-prod → Groq (llama) unless AI_PROVIDER overrides.
 */
import Groq from "groq-sdk";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "developer";
  content: string;
};

export function isOpenAiProvider(): boolean {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return true;
  if (forced === "groq") return false;
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function getLlmModel(): string {
  if (isOpenAiProvider()) {
    return (
      process.env.OPENAI_MODEL?.trim() ||
      process.env.OPENAI_CLASSIFY_MODEL?.trim() ||
      "gpt-4o-mini"
    );
  }
  // Groq retired the Llama chat models; the old default returned
  // model_not_found and surfaced as a 500 from /api/ai/extract. Verified
  // against the account's own model list on 2026-08-24. Override with
  // GROQ_MODEL when the catalogue moves again.
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

export function getLlmModelVersion(model = getLlmModel()): string {
  return isOpenAiProvider() ? `openai:${model}` : `groq:${model}`;
}

export function assertLlmConfigured(): void {
  if (isOpenAiProvider()) {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return;
  }
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error("GROQ_API_KEY is not configured");
  }
}

export async function createChatCompletion(options: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  model?: string;
}): Promise<{ content: string; modelVersion: string }> {
  assertLlmConfigured();
  const model = options.model || getLlmModel();

  if (isOpenAiProvider()) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens,
        ...(options.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    return {
      content: payload.choices?.[0]?.message?.content || "",
      modelVersion: getLlmModelVersion(model),
    };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY!.trim() });
  const completion = await groq.chat.completions.create({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.maxTokens,
    ...(options.json ? { response_format: { type: "json_object" as const } } : {}),
  });

  return {
    content: completion.choices[0]?.message?.content || "",
    modelVersion: getLlmModelVersion(model),
  };
}

/** Yields text deltas from a streaming chat completion. */
export async function* streamChatCompletion(options: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}): AsyncGenerator<string, { modelVersion: string }, void> {
  assertLlmConfigured();
  const model = options.model || getLlmModel();

  if (isOpenAiProvider()) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`OpenAI stream failed (${response.status}): ${detail.slice(0, 300)}`);
    }
    if (!response.body) throw new Error("OpenAI stream returned no body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip malformed SSE chunks
        }
      }
    }

    return { modelVersion: getLlmModelVersion(model) };
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY!.trim() });
  const completion = await groq.chat.completions.create({
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1024,
    stream: true,
  });

  for await (const chunk of completion) {
    const delta = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) yield delta;
  }

  return { modelVersion: getLlmModelVersion(model) };
}
