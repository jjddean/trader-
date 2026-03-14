import { routeAgentRequest } from "agents";
export { AgentOrchestrator, AgentOrchestrator as ORCHESTRATOR } from "./agents/orchestrator";
export { AgentCompliance, AgentCompliance as COMPLIANCE_AGENT } from "./agents/compliance";
export { AgentProduct, AgentProduct as PRODUCT_AGENT } from "./agents/product";
export { AgentWorkflow, AgentWorkflow as TRADE_WORKFLOW } from "./agents/workflow";

export interface Env {
    AI: any;
    DCTS_VECTORIZE: any;
    COMPANY_VECTORIZE: any;
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
 
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Scheduled task to embed unembedded companies
        const unembedded = await env.DB.prepare(
            "SELECT id, name, description, products, hs_codes FROM companies WHERE embedding_id IS NULL LIMIT 100"
        ).all();

        for (const company of unembedded.results) {
            const text = `Company: ${company.name}. Products: ${company.products}. HS Codes: ${company.hs_codes}. Description: ${company.description}`;
            const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [text] });
            const vectorId = `company_${company.id}`;

            await (env.COMPANY_VECTORIZE as any).insert([{
                id: vectorId,
                values: embedding.data[0],
                metadata: { companyId: company.id, name: company.name, country: (company as any).country_code }
            }]);

            await env.DB.prepare("UPDATE companies SET embedding_id = ? WHERE id = ?").bind(vectorId, company.id).run();
        }
    }
};
