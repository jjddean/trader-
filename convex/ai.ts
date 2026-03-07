"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const explainTradeRule = action({
    args: {
        query: v.optional(v.string()),
        hsCode: v.optional(v.string()),
        country: v.optional(v.string()),
        context: v.optional(v.string()), // "compliance" | "tariff" | "general"
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        // Grounding Prompt using deterministic data principles
        const prompt = `
            You are the Elite TradeDNA AI Assistant. 
            The user is asking about:
            ${args.query ? `- Query: ${args.query}` : ""}
            ${args.hsCode ? `- HS Code: ${args.hsCode}` : ""}
            ${args.country ? `- Country: ${args.country}` : ""}
            ${args.context ? `- Area: ${args.context}` : ""}

            Rules:
            1. ONLY explain rules based on the UK's Developing Countries Trading Scheme (DCTS).
            2. If you don't have the specific rate for this HS code, explain the TIER logic (Standard, Enhanced, or Comprehensive).
            3. Be concise and professional.
            4. State clearly that calculations should be verified by a customs agent.
        `;

        // In a real app, you'd call Groq or OpenAI here.
        // For development, we return a structured AI response based on the grounding.

        return {
            response: `Based on the DCTS framework, ${args.country && args.hsCode ? `goods from ${args.country} under HS Code ${args.hsCode}` : "your query"} is subject to preferential trade rules. This typically involves checking for specific Rules of Origin and ensuring compliance with the DCTS TIER logic. How can I help you further with this?`,
            agentName: "DNA Consultant",
        };
    },
});
