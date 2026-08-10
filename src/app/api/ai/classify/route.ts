import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AI_MAX_CLASSIFY_CHARS, aiClassifyLimiter } from "@/lib/api-rate-limiter";
import { assertLlmConfigured, createChatCompletion } from "@/lib/llm-chat";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (!aiClassifyLimiter.tryConsume(userId)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { description } = await request.json();

    if (!description || typeof description !== "string") {
      return NextResponse.json({ error: "Missing description" }, { status: 400 });
    }
    if (description.length > AI_MAX_CLASSIFY_CHARS) {
      return NextResponse.json({ error: "Description too long" }, { status: 413 });
    }

    try {
      assertLlmConfigured();
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "LLM not configured" },
        { status: 500 },
      );
    }

    const { content: responseContent } = await createChatCompletion({
      json: true,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are an expert UK Customs Broker. I will provide a description of a product being imported into the UK. Your job is to classify it into the most accurate 10-digit Harmonized System (HS) code. 
          Return a JSON object containing a "suggestions" array with exactly the top 3 suggested codes. Each object should have "code" (string, 10 digits) and "reason" (string, a very brief explanation why). DO NOT include markdown code blocks.`,
        },
        {
          role: "user",
          content: `Import product description: ${description}`,
        },
      ],
    });

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent || "{}");
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const suggestions = Array.isArray(parsedResponse)
      ? parsedResponse
      : parsedResponse.suggestions || parsedResponse.codes || Object.values(parsedResponse)[0];

    if (!Array.isArray(suggestions)) {
      return NextResponse.json({ error: "Unexpected AI format", content: parsedResponse }, { status: 500 });
    }

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("AI Classification Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
