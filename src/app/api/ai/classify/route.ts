import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(request: Request) {
  try {
    const { description } = await request.json();

    if (!description) {
      return NextResponse.json({ error: "Missing description" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!groqApiKey) {
      return NextResponse.json({ error: "Groq API Key not configured" }, { status: 500 });
    }

    const groq = new Groq({ apiKey: groqApiKey });

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an expert UK Customs Broker. I will provide a description of a product being imported into the UK. Your job is to classify it into the most accurate 10-digit Harmonized System (HS) code. 
          Return a JSON object containing a "suggestions" array with exactly the top 3 suggested codes. Each object should have "code" (string, 10 digits) and "reason" (string, a very brief explanation why). DO NOT include markdown code blocks.`
        },
        {
          role: "user",
          content: `Import product description: ${description}`
        }
      ],
      model: model,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    
    // The model might return `{ "suggestions": [...] }` or just `[...]` depending on nuances.
    // To be safe with `json_object` format on Groq, the model usually returns an object.
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Attempt to extract an array if the AI wrapped it in an object key
    const suggestions = Array.isArray(parsedResponse) 
      ? parsedResponse 
      : (parsedResponse.suggestions || parsedResponse.codes || Object.values(parsedResponse)[0]);

    if (!Array.isArray(suggestions)) {
      return NextResponse.json({ error: "Unexpected AI format", content: parsedResponse }, { status: 500 });
    }

    return NextResponse.json({ suggestions });

  } catch (error: any) {
    console.error("AI Classification Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
