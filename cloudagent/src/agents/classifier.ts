import { Agent, callable } from "agents";
import { Env } from "../index";
import { WORKERS_TEXT_MODEL } from "../lib/text-model";

export class AgentClassifier extends Agent<Env> {
    @callable()
    async ask(message: string) {
        try {
            if (message.toLowerCase() === "ping") return "CLASSIFIER_AGENT_PONG";

            // 1. Generate an embedding for the product description to search the Vectorize RAG database
            const queryVector = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [message] });

            // 2. Query the Vector DB (uk-global-tariff) for matches
            const matches = await this.env.TARIFF_VECTORIZE.query(queryVector.data[0], { topK: 3 });

            // 3. Use Llama-3 to definitively select the best 10-digit HS code based on the search
            const systemPrompt = `You are a certified UK Customs Tariff Classifier.
The user is describing a physical product. You must accurately determine the 10-digit HS Commodity Code required for a CDS H1 Import Declaration.
Use your embedded knowledge and the provided context matches.
Always respond with the 10-digit code formatted clearly, followed by a brief justification.`;

            const res = await this.env.AI.run(WORKERS_TEXT_MODEL, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            });

            return (res as any).response;

        } catch (error: any) {
            console.error("AgentClassifier Error:", error);
            return `[CLASSIFIER AGENT ERROR] ${error.message}`;
        }
    }
}
