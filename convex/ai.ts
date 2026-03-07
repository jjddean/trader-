"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const explainTradeRule = action({
    args: {
        hsCode: v.string(),
        country: v.string(),
        context: v.string(), // "compliance" | "tariff" | "general"
    },
    handler: async (ctx, args) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Unauthenticated");

        // Grounding Prompt using deterministic data principles
        const prompt = `
            You are the Elite TradeDNA AI Assistant. 
            The user is asking about:
            - HS Code: ${args.hsCode}
            - Country: ${args.country}
            - Area: ${args.context}

            Rules:
            1. ONLY explain rules based on the UK's Developing Countries Trading Scheme (DCTS).
            2. If you don't have the specific rate for this HS code, explain the TIER logic (Standard, Enhanced, or Comprehensive).
            3. Be concise and professional.
            4. State clearly that calculations should be verified by a customs agent.
        `;

        // In a real app, you'd call Groq or OpenAI here.
        // For development, we return a structured AI response based on the grounding.

        return {
            response: `Based on the DCTS framework, goods from ${args.country} under HS Code ${args.hsCode} are subject to ${args.context === 'compliance' ? 'specific Rules of Origin' : 'preferential tariff rates'}. In the context of your inquiry, this typically involves checking if at least 30-40% value was added locally.`,
            agentName: "DNA Consultant",
        };
    },
});
