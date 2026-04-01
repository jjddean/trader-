import { routeAgentRequest } from "agents";
import { GIR_AGENT_SYSTEM_PROMPT, buildGIRUserPrompt } from './prompts/girAgent';

export { AgentOrchestrator, AgentOrchestrator as ORCHESTRATOR } from "./agents/orchestrator";
export { AgentValidationError, AgentValidationError as VALIDATION_AGENT } from "./agents/validation";
export { AgentClassifier, AgentClassifier as CLASSIFIER_AGENT } from "./agents/classifier";

export interface Env {
    AI: any;
    HMRC_ERRORS_VECTORIZE: any;
    TARIFF_VECTORIZE: any;
    DB: D1Database;
    ORCHESTRATOR: DurableObjectNamespace<import("./agents/orchestrator").AgentOrchestrator>;
    VALIDATION_AGENT: DurableObjectNamespace<import("./agents/validation").AgentValidationError>;
    CLASSIFIER_AGENT: DurableObjectNamespace<import("./agents/classifier").AgentClassifier>;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle health check
		if (request.method === "GET" && url.pathname === "/") {
			return new Response("cloudagent ok", { status: 200 });
		}

		// Specialized GIR Classification endpoint (LoRA-ready)
		if (request.method === "POST" && url.pathname === "/classify-gir") {
			try {
				const { textractOutput, declaredHsCode } = await request.json() as any;

				const response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.2-lora', {
					messages: [
						{ role: 'system', content: GIR_AGENT_SYSTEM_PROMPT },
						{ role: 'user', content: buildGIRUserPrompt(textractOutput, declaredHsCode) }
					],
					lora: 'hs-classifier-v1', // Reference the fine-tune name from the guide
					max_tokens: 1000,
					temperature: 0.1
				});

				// Workers AI returns { response: "..." } or the raw output depending on the model
				const result = response.response ? JSON.parse(response.response) : response;
				return Response.json(result);
			} catch (error: any) {
				return new Response(JSON.stringify({ error: error.message }), { 
					status: 500, 
					headers: { 'Content-Type': 'application/json' } 
				});
			}
		}

		// Fallback to Agent Orchestration (Durable Objects)
		return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
	},
};
