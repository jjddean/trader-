import { routeAgentRequest } from "agents";
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
		if (request.method === "GET" && url.pathname === "/") {
			return new Response("cloudagent ok", { status: 200 });
		}
		return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
	},
 
    // The scheduled sync task for DCTS companies has been removed.
    // We will add a new scheduled task for syncing HMRC Tariffs later if needed.
};
