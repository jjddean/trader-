import { Agent, callable } from "agents";
import { Env } from "../index";
import { WORKERS_TEXT_MODEL } from "../lib/text-model";

export class AgentValidationError extends Agent<Env> {
    @callable()
    async ask(message: string) {
        try {
            // Fast path for basic queries
            if (message.toLowerCase() === "ping") return "VALIDATION_AGENT_PONG";

            // Extract the CDS Error Code (e.g., CDS40045, MALFORMED_XML)
            const errorCodeMatch = message.match(/(CDS\d{5}|[A-Z_]+_XML)/i);
            const errorCode = errorCodeMatch ? errorCodeMatch[1] : null;

            if (!errorCode) {
                return "I couldn't identify a specific HMRC error code in your message. Please provide the exact error code (like CDS40045) received from the Sandbox.";
            }

            // 1. Generate an embedding for the error code to search the Vectorize RAG database
            const queryVector = await this.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [errorCode] });

            // 2. Query the Vector DB (hmrc-cds-errors) for matches
            const matches = await this.env.HMRC_ERRORS_VECTORIZE.query(queryVector.data[0], { topK: 3 });

            // 3. Optional: Map the embeddings to actual D1 DB content if we have a table for it.
            // For now, we will construct a prompt using the generic knowledge since the Vector DB is empty locally.
            const contextText = "Assume HMRC documentation regarding this error.";

            const systemPrompt = `You are an expert HMRC Customs Declaration Service (CDS) Validation Assistant.
The user's declaration payload was rejected by the HMRC API Rules Engine.
Use the following context to explain why the code was rejected and what specific WCO Data Element is required to fix it:
---
Error Code Found: ${errorCode}
Context Evidence: ${contextText}
---
Provide a highly specific, actionable explanation.`;

            const res = await this.env.AI.run(WORKERS_TEXT_MODEL, {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            });

            return (res as any).response;

        } catch (error: any) {
            console.error("AgentValidationError Error:", error);
            return `[VALIDATION AGENT ERROR] ${error.message}`;
        }
    }
}
