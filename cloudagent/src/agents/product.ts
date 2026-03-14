import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { Env } from "../index";

export class AgentProduct extends AIChatAgent<Env> {
    @callable()
    async ask(message: string) {
        // 1. Get embedding for the query
        const queryEmbedding = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: [message]
        });

        // 2. Search company vector index
        const results = await this.env.COMPANY_VECTORIZE.query(queryEmbedding.data[0], {
            topK: 5,
            returnMetadata: true
        });

        // 3. Fetch full details from D1
        const companyIds = results.matches.map((m: any) => m.metadata.companyId);
        if (companyIds.length === 0) return "No matching trade partners found.";

        const placeholders = companyIds.map(() => '?').join(',');
        const companies = await this.env.DB.prepare(
            `SELECT * FROM companies WHERE id IN (${placeholders})`
        ).bind(...companyIds).all();

        // 4. Combine and respond
        const matchDetails = results.matches.map((match: any) => {
            const company = (companies.results as any[]).find((c: any) => c.id === match.metadata.companyId);
            return `- [ID: ${company?.id}] ${company?.name || 'Unknown'} (Similarity: ${(match.score * 100).toFixed(1)}%)`;
        }).join('\n');

        const prompt = `
You are a TradeDNA Product Matching Specialist. Based on these search results:
${matchDetails}

Summarize the best matching partners for the user's request: "${message}".
Explain WHY they are good matches based on their product profiles.
Mention that the user can "favorite" a partner by providing their ID.
`;

        const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: prompt }]
        });

        return (response as any).response;
    }

    @callable()
    async favoritePartner(partnerId: string) {
        const favorites: string[] = (await this.ctx.storage.get("favorites")) || [];
        if (!favorites.includes(partnerId)) {
            favorites.push(partnerId);
            await this.ctx.storage.put("favorites", favorites);
            return `Partner ${partnerId} added to favorites.`;
        }
        return `Partner ${partnerId} is already in favorites.`;
    }

    @callable()
    async getFavorites() {
        const favoriteIds: string[] = (await this.ctx.storage.get("favorites")) || [];
        if (favoriteIds.length === 0) return "No favorites saved yet.";

        const placeholders = favoriteIds.map(() => '?').join(',');
        const companies = await this.env.DB.prepare(
            `SELECT * FROM companies WHERE id IN (${placeholders})`
        ).bind(...favoriteIds).all();

        return companies.results;
    }

    @callable()
    async discover() {
        // Fetch up to 10 companies from D1 to sync as prospects
        const companies = await this.env.DB.prepare(
            `SELECT id, name, country_code, category, hs_codes FROM companies LIMIT 10`
        ).all();

        return companies.results.map((c: any) => ({
            companyName: c.name,
            country: c.country_code,
            primaryHS: c.hs_codes,
            dctsTier: c.category || "Comprehensive",
            businessCategory: "Matched Trade Partner",
            reliabilityScore: 0.85 + (Math.random() * 0.1),
            status: "New"
        }));
    }
}
