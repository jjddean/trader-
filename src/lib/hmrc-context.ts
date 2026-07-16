/**
 * Per-org HMRC routing — practice (sandbox) vs live (production API host).
 * Credentials remain deployment env vars; org mode selects which set applies.
 */

export type HmrcOrgMode = "practice" | "live";

export interface ResolvedHmrcContext {
  orgMode: HmrcOrgMode;
  environment: "sandbox" | "production";
  phase: "trade_test" | "tdr" | "live";
  apiBaseUrl: string;
  declarationsAccept: string;
  informationAccept: string;
  oauthAuthorizeBaseUrl: string;
  clientId: string;
  clientSecret: string;
}

const V1_XML = process.env.HMRC_ACCEPT_V1_XML || "application/vnd.hmrc.1.0+xml";
const V2_XML = process.env.HMRC_ACCEPT_V2_XML || "application/vnd.hmrc.2.0+xml";

/**
 * Resolve the CDS phase for a specific HMRC environment (host), not the
 * deployment as a whole. See docs/hmrc/ACTIVE/tdr/environment-matrix.md:
 *   - sandbox host  → Trade Test (v2.0, archived) or TDR (v1.0, current)
 *   - production host → TDR-on-production (v1.0) while pinned to tdr, else CDS Live (v2.0)
 * This lets a Live (production) org route v2.0 while sandbox orgs stay TDR v1.0.
 */
function resolvePhaseForEnvironment(
  environment: "sandbox" | "production",
): "trade_test" | "tdr" | "live" {
  const label = (process.env.NEXT_PUBLIC_HMRC_ENV || "").toLowerCase();

  if (environment === "production") {
    // An org explicitly pinned to the TDR intermediate keeps v1.0 declarations;
    // otherwise the production host means full CDS Live (v2.0).
    return label === "tdr" ? "tdr" : "live";
  }

  // Sandbox host is never "live".
  if (label === "tdr") return "tdr";
  if (process.env.HMRC_DECLARATIONS_ACCEPT?.includes("1.0")) return "tdr";
  return "trade_test";
}

function declarationsAcceptForPhase(phase: "trade_test" | "tdr" | "live"): string {
  if (process.env.HMRC_DECLARATIONS_ACCEPT) return process.env.HMRC_DECLARATIONS_ACCEPT;
  return phase === "tdr" ? V1_XML : V2_XML;
}

function informationAcceptForEnvironment(environment: "sandbox" | "production", phase: "trade_test" | "tdr" | "live"): string {
  if (process.env.HMRC_INFORMATION_ACCEPT) return process.env.HMRC_INFORMATION_ACCEPT;
  if (environment === "sandbox") return V1_XML;
  return phase === "trade_test" ? V1_XML : V2_XML;
}

function oauthCredentials(environment: "sandbox" | "production"): { clientId: string; clientSecret: string } {
  if (environment === "sandbox") {
    return {
      clientId: process.env.HMRC_SANDBOX_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
      clientSecret: process.env.HMRC_SANDBOX_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
    };
  }
  return {
    clientId: process.env.HMRC_PRODUCTION_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
    clientSecret: process.env.HMRC_PRODUCTION_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
  };
}

/** Resolve HMRC host, Accept headers, and OAuth creds for an org mode (defaults to practice). */
export function resolveHmrcContext(orgMode?: HmrcOrgMode | null): ResolvedHmrcContext {
  const mode: HmrcOrgMode = orgMode === "live" ? "live" : "practice";
  const environment: "sandbox" | "production" = mode === "live" ? "production" : "sandbox";
  const phase = resolvePhaseForEnvironment(environment);
  const sandboxBase = process.env.HMRC_SANDBOX_BASE_URL || "https://test-api.service.hmrc.gov.uk";
  const productionBase = process.env.HMRC_PRODUCTION_BASE_URL || "https://api.service.hmrc.gov.uk";
  const creds = oauthCredentials(environment);

  return {
    orgMode: mode,
    environment,
    phase,
    apiBaseUrl: environment === "sandbox" ? sandboxBase : productionBase,
    declarationsAccept: declarationsAcceptForPhase(phase),
    informationAccept: informationAcceptForEnvironment(environment, phase),
    oauthAuthorizeBaseUrl:
      environment === "sandbox"
        ? process.env.HMRC_SANDBOX_OAUTH_AUTHORIZE_URL?.replace(/\/$/, "") ||
          "https://test-www.tax.service.gov.uk"
        : process.env.HMRC_PRODUCTION_OAUTH_AUTHORIZE_URL?.replace(/\/$/, "") ||
          "https://www.tax.service.gov.uk",
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  };
}

/** Block submit when org live mode disagrees with deployment sandbox flag (misconfiguration guard). */
export function assertOrgHmrcRoutingAllowed(orgMode: HmrcOrgMode | null | undefined): string | null {
  const mode = orgMode === "live" ? "live" : "practice";
  const deploymentSandbox = process.env.HMRC_ENVIRONMENT === "sandbox";
  if (mode === "live" && deploymentSandbox && !process.env.HMRC_ALLOW_LIVE_ON_SANDBOX_DEPLOY) {
    return "Organisation is set to Live CDS but this deployment is sandbox-only. Contact support or flip org to practice.";
  }
  if (mode === "practice" && !deploymentSandbox && process.env.HMRC_REQUIRE_ORG_LIVE_ON_PROD === "true") {
    return "Organisation is in practice mode but this deployment expects live CDS. Request production access for your org.";
  }
  return null;
}

/** Global fallback — preserves legacy single-env behaviour when no org id is available. */
export function resolveDeploymentHmrcContext(): ResolvedHmrcContext {
  const environment = process.env.HMRC_ENVIRONMENT === "production" ? "production" : "sandbox";
  return resolveHmrcContext(environment === "production" ? "live" : "practice");
}
