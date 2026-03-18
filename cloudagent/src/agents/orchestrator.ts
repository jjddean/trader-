import { Agent, callable } from "agents";
import { Env } from "../index";

export class AgentOrchestrator extends Agent<Env> {
    @callable()
    async ask(message: string) {
        try {
            // Fast path for ping to skip AI
            if (message.toLowerCase() === "ping") return "PONG!";

            // 1. Maintain conversation history in Durable Storage
            const history: { role: string; content: string }[] =
                (await this.ctx.storage.get("history")) || [];

            // Add user message to history
            history.push({ role: "user", content: message });

            const intent = await this.classifyIntent(message, history);
            const validationId = this.env.VALIDATION_AGENT.idFromName("global");
            const classifierId = this.env.CLASSIFIER_AGENT.idFromName("global");

            let response: string;
            switch (intent) {
                case "validation":
                    response = await (this.env.VALIDATION_AGENT.get(validationId) as any).ask(message);
                    break;
                case "classification":
                    response = await (this.env.CLASSIFIER_AGENT.get(classifierId) as any).ask(message);
                    break;
                default:
                    response = await this.handleGeneralChat(message, history);
            }

            // Add assistant response to history and trim to last 5 messages to avoid context window issues
            history.push({ role: "assistant", content: response });
            if (history.length > 5) history.shift();
            await this.ctx.storage.put("history", history);

            return response;
        } catch (error: any) {
            console.error("Orchestrator Error:", error);
            return `[ORCHESTRATOR ERROR] ${error.message || error}`;
        }
    }

    private async classifyIntent(text: string, history: any[]): Promise<string> {
        const res = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
                { role: 'system', content: 'Classify the user intent into exactly one of these three categories: "validation" (if they are asking about an HMRC CDS error code like CDS40045, MALFORMED_XML, or a rejection), "classification" (if they are describing a product and need an HS/commodity code), or "general" (if it is a general question). Reply with ONLY the single word: validation, classification, or general.' },
                ...history.slice(-3),
                { role: 'user', content: text }
            ]
        });
        return (res as any).response.trim().toLowerCase();
    }

    private async handleGeneralChat(text: string, history: any[]) {
        const res = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
                { role: 'system', content: 'You are the HMRC CDS Orchestrator Copilot. You help users clear their goods through customs.' },
                ...history,
                { role: 'user', content: text }
            ]
        });
        return (res as any).response;
    }

    @callable()
    async getHistory() {
        return (await this.ctx.storage.get("history")) || [];
    }

    @callable()
    async clearHistory() {
        await this.ctx.storage.delete("history");
        return "History cleared.";
    }

    async onRequest(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const methodMatch = url.pathname.match(/\/call\/(\w+)$/);
        
        if (request.method === "POST" && methodMatch) {
            const methodName = methodMatch[1];
            try {
                const body = await request.json() as any[];
                let result: any;
                
                if (methodName === "ask") {
                    result = await this.ask(body[0]);
                } else if (methodName === "clearHistory") {
                    result = await this.clearHistory();
                } else {
                    return new Response("Method not found", { status: 404 });
                }

                return new Response(JSON.stringify(result), {
                    headers: { "Content-Type": "application/json" }
                });
            } catch (error: any) {
                return new Response(JSON.stringify({ error: error.message }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }
        }
        return new Response("Not found", { status: 404 });
    }
}
