import { routeAgentRequest } from "agents";
import { GIR_AGENT_SYSTEM_PROMPT, buildGIRUserPrompt } from './prompts/girAgent';
import { parseWorkersAiJson } from "./lib/parse-ai-json";
import { WORKERS_TEXT_MODEL } from "./lib/text-model";

const DOCUMENT_CLASSIFIER_PROMPT = `You are a Document Classification Agent for UK customs declarations.
Analyze OCR text from a trade document and return ONLY valid JSON (no markdown):
{
  "documentType": "string (e.g., Commercial Invoice, Packing List)",
  "complianceFlags": ["string array of missing fields or suspicious details"],
  "extractedFields": { "value": "numeric or null", "origin": "string ISO country code or empty", "dates": ["string"] },
  "status": "Verified | Review | Missing"
}`;

function normaliseGirResult(result: unknown): unknown {
	if (!result || typeof result !== "object") return result;
	const record = result as Record<string, any>;
	const hs = typeof record.correctHsCode === "string" ? record.correctHsCode.replace(/\D/g, "") : "";
	if (!/^\d{10}$/.test(hs)) return result;

	const expectedHeading = hs.slice(0, 4);
	const text = `${record.verdictReasoning ?? ""}\n${record.officerExplanation ?? ""}`;
	const headingMatches = [...text.matchAll(/\bheading\s+(\d{4})\b/gi)].map((match) => match[1]);
	const wrongHeading = headingMatches.find((heading) => heading !== expectedHeading);
	if (!wrongHeading) return result;

	return {
		...record,
		complianceVerdict: "AMBIGUOUS",
		verdictReasoning: `Model output was internally inconsistent: it returned HS ${hs} but referenced heading ${wrongHeading}. Human review required before relying on this advisory classification.`,
		officerExplanation: `Advisory classifier inconsistency detected. The returned commodity code starts with heading ${expectedHeading}, but the explanation referenced heading ${wrongHeading}. Review the invoice text and UK Trade Tariff manually.`,
	};
}

export { AgentOrchestrator, AgentOrchestrator as ORCHESTRATOR } from "./agents/orchestrator";
export { AgentValidationError, AgentValidationError as VALIDATION_AGENT } from "./agents/validation";
export { AgentClassifier, AgentClassifier as CLASSIFIER_AGENT } from "./agents/classifier";

export interface Env {
    AI: any;
    HMRC_ERRORS_VECTORIZE: any;
    TARIFF_VECTORIZE: any;
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

				if (!textractOutput || !declaredHsCode) {
					return new Response(JSON.stringify({ error: "Missing textractOutput or declaredHsCode" }), {
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					});
				}

			let response: any;
			try {
				// Try LoRA model first (if trained and deployed)
				response = await env.AI.run('@cf/mistral/mistral-7b-instruct-v0.2-lora', {
					messages: [
						{ role: 'system', content: GIR_AGENT_SYSTEM_PROMPT },
						{ role: 'user', content: buildGIRUserPrompt(textractOutput, declaredHsCode) }
					],
					lora: 'hs-classifier-v1', // Reference the fine-tune name from the guide
					max_tokens: 1000,
					temperature: 0.1
				});
			} catch (loraError: any) {
				// Fallback to base model if LoRA not available
				console.warn(`LoRA model not available, falling back to base model: ${loraError.message}`);
				response = await env.AI.run(WORKERS_TEXT_MODEL, {
					messages: [
						{ role: 'system', content: GIR_AGENT_SYSTEM_PROMPT },
						{ role: 'user', content: buildGIRUserPrompt(textractOutput, declaredHsCode) }
					],
					max_tokens: 1000,
					temperature: 0.1
				});
			}

			// Workers AI returns { response: "..." } or structured output depending on the model
			const result = normaliseGirResult(parseWorkersAiJson(response));

			return Response.json(result);
			} catch (error: any) {
				console.error(`GIR classification error: ${error.message}`, { stack: error.stack });
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}

		// Customs document OCR classifier (Commercial Invoice, Packing List, etc.)
		if (request.method === "POST" && url.pathname === "/classify-document") {
			try {
				const { ocrText } = await request.json() as { ocrText?: string };
				if (!ocrText || !String(ocrText).trim()) {
					return Response.json({ error: "Missing ocrText" }, { status: 400 });
				}

				const response = await env.AI.run(WORKERS_TEXT_MODEL, {
					messages: [
						{ role: "system", content: DOCUMENT_CLASSIFIER_PROMPT },
						{ role: "user", content: `OCR Text:\n\n${String(ocrText).slice(0, 12000)}` },
					],
					max_tokens: 1200,
					temperature: 0.1,
				});

				const result = parseWorkersAiJson(response);
				return Response.json(result);
			} catch (error: any) {
				console.error(`Document classification error: ${error.message}`, { stack: error.stack });
				return Response.json({ error: error.message }, { status: 500 });
			}
		}

		// Fallback to Agent Orchestration (Durable Objects)
		return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
	},
};
