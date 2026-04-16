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
    // if (!identity) throw new Error("Unauthenticated");

    if (!identity) {
      return {
        response: `[DEMO MODE] To generate a custom B2B outreach email for HS Code ${args.hsCode || "selected products"} from ${args.country || "the origin country"}, please ensure you are signed in. This AI generation uses the DCTS framework to highlight 0% duty advantages for UK imports.`,
        agentName: "DNA Consultant (Demo)",
      };
    }

    const effectiveQuery = args.query ?? 
      `Explain trade rule for HS Code ${args.hsCode} from ${args.country} in context of ${args.context}`;

    const agentUrl = (process.env.AGENT_URL || "").trim();
    if (!agentUrl) {
      return {
        response: `[AGENT URL MISSING] AGENT_URL is not configured in Convex environment.`,
        agentName: "DNA Consultant (Offline)",
      };
    }

    console.log(`[explainTradeRule] Using AGENT_URL: ${agentUrl}`);

    try {
      // Connect to the Cloudflare Agent via the provided URL
      const response = await fetch(`${agentUrl.replace(/\/$/, "")}/agents/orchestrator/global/call/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify([effectiveQuery]),
      });

      if (!response.ok) {
        throw new Error(`Agent response error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        response: String(result),
        agentName: "DNA Consultant",
      };
    } catch (error) {
      console.error("Convex Agent Error:", error);
      // Fallback if worker is not running or unreachable
      return {
        response: `[AGENT UNREACHABLE] The Convex cloud tried to talk to the Agent at ${agentUrl} but failed. 
        
If you are developing locally, ensure:
1. 'npx convex dev' is running to push this code.
2. The Agent is accessible via a public tunnel (like ngrok) if Convex is remote.
3. Current error: ${String(error)}`,
        agentName: "DNA Consultant (Offline)",
      };
    }
  },
});

