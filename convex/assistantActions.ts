import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

export const sendChatMessage = action({
  args: {
    declarationId: v.id("declarations"),
    messageBody: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(api.assistantQueries.getDeclarationContextForAI, {
      declarationId: args.declarationId,
    });

    await ctx.runMutation(api.assistantMutations.appendChatMessage, {
      workspaceId: context.workspaceId,
      declarationId: args.declarationId,
      role: "user",
      body: args.messageBody,
    });

    const systemPrompt = `You are the TradeDNA AI consultant running inside the freightcode platform.
Situational Awareness Framework:
- Active Conversation ID: ${context.conversationId}
- Live Custom Entry Status: ${context.status}
- Account Establishment Configuration: ${context.isUKEstablished ? "UK Domestic" : "Non-UK Established (Requires Indirect Rep Code 3)"}
- Live Valuation Duty Matrix: £${context.estimatedDutyGBP} GBP

Target Verification Logs Data:
${context.rawHmrcErrorLogs}

CRITICAL: Evaluate instructions step-by-step using the 6 General Interpretative Rules (GIRs). If you discover a clean 10-digit commodity code matching their description or resolving their error, append it explicitly at the very end of your response using this tag pattern: [UPDATE_CODE:10_DIGIT_NUM].`;

    const response = await fetch("https://groq.com", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.messageBody },
        ],
      }),
    });

    const aiResult = await response.json() as any;
    if (!aiResult.choices || aiResult.choices.length === 0) {
      throw new Error("Groq API returned an empty completion choice array.");
    }
    
    const assistantReply = aiResult.choices[0].message.content;

    await ctx.runMutation(api.assistantMutations.appendChatMessage, {
      workspaceId: context.workspaceId,
      declarationId: args.declarationId,
      role: "assistant",
      body: assistantReply,
    });

    const codeExtractor = assistantReply.match(/\[UPDATE_CODE:([0-9]{10})\]/);
    if (codeExtractor) {
      const extractedCode = codeExtractor[1];
      await ctx.runMutation(api.assistantMutations.updateCommodityCodeFromChat, {
        declarationId: args.declarationId,
        commodityCode: extractedCode,
      });
    }

    return assistantReply;
  },
});
