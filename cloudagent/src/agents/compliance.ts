import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { Env } from "../index";

export class AgentCompliance extends AIChatAgent<Env> {
    @callable()
    async ask(message: string) {
        // 1. Retrieve relevant DCTS rules from vector index
        // Using a simpler query for classification/retrieval
        const queryEmbedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [message]
        });

        const rules = await this.env.DCTS_VECTORIZE.query(queryEmbedding.data[0], {
            topK: 5,
            returnMetadata: true
        });

        // 2. Build prompt with context
        const context = rules.matches.map((m: any) => m.metadata.text || JSON.stringify(m.metadata)).join('\n');
        const prompt = `
You are a DCTS (Developing Countries Trading Scheme) expert. Based ONLY on the following rules, answer the query truthfully.

RULES:
${context}

QUERY: ${message}

Provide:
- Eligibility (YES/NO/MAYBE)
- Saving Potential
- Required documents
- Confidence (HIGH/MEDIUM/LOW)
`;

        const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: prompt }]
        });

        return (response as any).response;
    }
}
