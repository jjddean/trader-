import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const SYSTEM_PROMPT = `You are the Freightcode AI consultant, a UK customs and trade compliance expert helping importers and customs brokers.

You assist with:
- HMRC CDS error diagnosis (CDS40045, CDS12050, MALFORMED_XML, etc.)
- HS / commodity code classification using the 6 General Interpretative Rules (GIRs)
- UK Global Tariff lookups, duty rates, and preference origin (DCTS, Rules of Origin)
- CDS data element guidance (DE 1/10, 1/11, 6/8, etc.) and procedure codes
- Document requirements (C088, N935, Y929, licensing codes)

Be concise, accurate, and cite the relevant CDS data element or tariff rule when applicable. If you are unsure, say so rather than guessing.`;

function buildSystemPrompt(context: any) {
  const declarationSummary = context.declaration
    ? `Active declaration context: ${JSON.stringify({
        mrn: context.declaration.mrn,
        status: context.declaration.status,
        eori: context.declaration.eori,
        hmrcConversationId: context.declaration.conversationId,
      })}`
    : "No declaration is currently linked to this assistant request.";

  const validationSummary = (context.validationFailures || []).slice(0, 5).map((row: any) => ({
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    severity: row.severity,
    reason: row.reason,
    field: row.field,
  }));

  const notificationSummary = (context.recentNotifications || []).slice(0, 5).map((row: any) => ({
    type: row.notificationType,
    timestamp: row.timestamp,
    errorCodes: row.errorCodes || [],
  }));

  const documentSummary = (context.recentDocuments || []).slice(0, 5).map((row: any) => ({
    fileName: row.fileName,
    status: row.status || row.auditStatus,
    declarationId: row.declarationId || null,
  }));

  const declarationList = (context.openDeclarations || []).slice(0, 10).map((row: any) => ({
    declarationId: row.declarationId,
    mrn: row.mrn || null,
    status: row.status,
  }));

  return `${SYSTEM_PROMPT}

${declarationSummary}
Open declarations: ${JSON.stringify(declarationList)}
Recent documents: ${JSON.stringify(documentSummary)}
Recent HMRC notifications: ${JSON.stringify(notificationSummary)}
Recent validation failures: ${JSON.stringify(validationSummary)}

Stay tied to customs workflows. Do not invent compliance outcomes. Deterministic validation results remain authoritative.`;
}

export async function POST(request: Request) {
  let convex: ConvexHttpClient | null = null;
  let conversationId: any = null;
  let assistantMessageId: any = null;
  let model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  try {
    const clerkAuth = await auth();
    const { userId } = clerkAuth;
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const convexToken = await clerkAuth.getToken({ template: "convex" });
    if (!convexToken) {
      return NextResponse.json({ error: "Convex auth token missing" }, { status: 401 });
    }

    convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);

    const { query, declarationId } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Groq API Key not configured" }, { status: 500 });
    }

    const conversation = await convex.mutation(
      api.assistantMutations.ensureConversation,
      declarationId ? { declarationId } : {},
    );
    conversationId = conversation._id;

    const context = await convex.query(
      api.assistantQueries.getAssistantContext,
      declarationId ? { declarationId } : {},
    );

    await convex.mutation(api.assistantMutations.appendUserMessage, {
      conversationId,
      content: query,
      metadata: {
        declarationId: declarationId ?? null,
        transport: "/api/ai/chat",
      },
    });

    assistantMessageId = await convex.mutation(api.assistantMutations.startAssistantMessage, {
      conversationId,
      metadata: {
        declarationId: declarationId ?? null,
        model,
        state: "streaming",
      },
    });

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(context) },
        ...((context.chatHistory || []).map((message: any) => ({
          role: message.role,
          content: message.content,
        }))),
        { role: "user", content: query },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      stream: true,
    });

    let text = "";
    let lastPersistedLength = 0;
    let lastPersistAt = 0;

    for await (const chunk of completion) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (!delta) continue;
      text += delta;

      const now = Date.now();
      if (text.length - lastPersistedLength >= 40 || now - lastPersistAt >= 250) {
        await convex.mutation(api.assistantMutations.updateAssistantMessage, {
          messageId: assistantMessageId,
          content: text,
          streamed: true,
          metadata: {
            declarationId: declarationId ?? null,
            model,
            state: "streaming",
          },
        });
        lastPersistedLength = text.length;
        lastPersistAt = now;
      }
    }

    text = text.trim();
    if (!text) {
      throw new Error("Empty completion");
    }

    await convex.mutation(api.assistantMutations.finalizeAssistantMessage, {
      messageId: assistantMessageId,
      content: text,
      metadata: {
        declarationId: declarationId ?? null,
        model,
        state: "complete",
      },
    });

    return NextResponse.json({ response: text });
  } catch (error) {
    const message = String(error);
    console.error("[/api/ai/chat] error:", error);

    if (convex && assistantMessageId) {
      try {
        await convex.mutation(api.assistantMutations.finalizeAssistantMessage, {
          messageId: assistantMessageId,
          content: "I couldn't reach the AI service right now. Please try again in a moment.",
          metadata: {
            model,
            state: "error",
            error: message,
          },
        });
      } catch (finalizeError) {
        console.error("[/api/ai/chat] failed to finalize assistant error message:", finalizeError);
      }
    } else if (convex && conversationId) {
      try {
        await convex.mutation(api.assistantMutations.setConversationStatus, {
          conversationId,
          status: "error",
        });
      } catch (statusError) {
        console.error("[/api/ai/chat] failed to mark conversation as error:", statusError);
      }
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
