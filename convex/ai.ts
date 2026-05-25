"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

export const explainTradeRule = action({
  args: {
    query: v.optional(v.string()),
    hsCode: v.optional(v.string()),
    country: v.optional(v.string()),
    context: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const effectiveQuery = args.query ??
      `Explain the trade rule for HS Code ${args.hsCode} from ${args.country} in the context of ${args.context}`;

    const agentUrl = (process.env.AGENT_URL || "").trim().replace(/\/$/, "");
    if (!agentUrl) {
      return {
        response: `[AGENT URL MISSING] AGENT_URL is not configured in Convex environment.`,
        agentName: "Freightcode AI (Offline)",
      };
    }

    try {
      const response = await fetch(`${agentUrl}/agents/orchestrator/global/call/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([effectiveQuery]),
      });

      if (!response.ok) {
        throw new Error(`Agent ${response.status} ${response.statusText}`);
      }

      const raw = await response.json();
      const text = typeof raw === "string" ? raw.trim() : String(raw ?? "").trim();
      if (!text || text.startsWith("[ORCHESTRATOR ERROR]")) {
        throw new Error(text || "Empty agent response");
      }

      return { response: text, agentName: "Freightcode AI" };
    } catch (error) {
      console.error("[explainTradeRule] Agent error:", error);
      return {
        response: `I couldn't reach the AI service right now. Please try again in a moment. (${String(error)})`,
        agentName: "Freightcode AI (Offline)",
      };
    }
  },
});

