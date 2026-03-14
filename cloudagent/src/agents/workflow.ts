import { Agent, callable } from "agents";
import { Env } from "../index";

export class AgentWorkflow extends Agent<Env> {
    @callable()
    async runAudit(hsCode: string, countryCode: string, partnerId: string) {
        // We use the DO's storage to track progress (Durability)
        await this.ctx.storage.put("status", "Starting Audit");

        // Step 1: Compliance Audit
        const complianceId = this.env.COMPLIANCE_AGENT.idFromName("global");
        const complianceResult = await (this.env.COMPLIANCE_AGENT.get(complianceId) as any).ask(
            `Perform detailed DCTS audit for HS code ${hsCode} from ${countryCode}`
        );
        await this.ctx.storage.put("compliance_result", complianceResult);
        await this.ctx.storage.put("status", "Compliance Check Done");

        // Step 2: Partner Verification
        const productId = this.env.PRODUCT_AGENT.idFromName("global");
        const favorites: any = await (this.env.PRODUCT_AGENT.get(productId) as any).getFavorites();
        const isFavorite = Array.isArray(favorites) && favorites.some((f: any) => f.id === partnerId);

        const partnerResult = {
            partnerId,
            isFavorite,
            status: "Verified in D1"
        };
        await this.ctx.storage.put("partner_result", partnerResult);
        await this.ctx.storage.put("status", "Partner Verification Done");

        // Step 3: Final Synthesis & Draft
        const orchestratorId = this.env.ORCHESTRATOR.idFromName("global");
        const finalReport = await (this.env.ORCHESTRATOR.get(orchestratorId) as any).ask(
            `Synthesize audit results: Compliance [${complianceResult}], Partner [${JSON.stringify(partnerResult)}]. Draft a final recommendation.`
        );

        await this.ctx.storage.put("final_report", finalReport);
        await this.ctx.storage.put("status", "Audit Completed");

        return finalReport;
    }

    @callable()
    async getStatus() {
        return {
            status: await this.ctx.storage.get("status"),
            compliance: await this.ctx.storage.get("compliance_result"),
            partner: await this.ctx.storage.get("partner_result"),
            report: await this.ctx.storage.get("final_report")
        };
    }
}
