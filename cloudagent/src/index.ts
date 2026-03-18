import { routeAgentRequest } from "agents";
export { AgentOrchestrator, AgentOrchestrator as ORCHESTRATOR } from "./agents/orchestrator";
export { AgentCompliance, AgentCompliance as COMPLIANCE_AGENT } from "./agents/compliance";
export { AgentProduct, AgentProduct as PRODUCT_AGENT } from "./agents/product";
export { AgentWorkflow, AgentWorkflow as TRADE_WORKFLOW } from "./agents/workflow";

export interface Env {
    AI: any;
    HMRC_ERRORS_VECTORIZE: any;
    TARIFF_VECTORIZE: any;
    DB: D1Database;
    ORCHESTRATOR: DurableObjectNamespace<import("./agents/orchestrator").AgentOrchestrator>;
    COMPLIANCE_AGENT: DurableObjectNamespace<import("./agents/compliance").AgentCompliance>;
    PRODUCT_AGENT: DurableObjectNamespace<import("./agents/product").AgentProduct>;
    TRADE_WORKFLOW: DurableObjectNamespace<import("./agents/workflow").AgentWorkflow>;
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
