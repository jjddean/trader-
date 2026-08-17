/**
 * Transport routing — decides whether a declaration goes direct to HMRC CDS or
 * through the CNS inventory-linked gateway.
 *
 * The decision is made once and persisted on the declaration before the first
 * outbound attempt (spec §5.2). It must never be recomputed from mutable form
 * fields afterwards: amendments and cancellations follow the original route.
 */

import { isCnsUsable, readCnsConfig, type CnsConfig } from "./config";
import { normalizeUcn } from "./inventory-xml";

export type SubmissionTransport = "hmrc_direct" | "cns_inventory";

export interface CnsRoutingDeclaration {
  /** "import" | "export" — only imports are in phase 1. */
  route?: unknown;
  locationId?: unknown;
  cnsUcn?: unknown;
}

export interface CnsRoutingOrg {
  /** Org is entitled to file through FreightCode's managed CNS clearance. */
  cnsClearanceEnabled?: boolean;
}

export interface CnsRoutingClient {
  /**
   * The client holds their own licensed CNS badge.
   *
   * CNS onboarding correspondence is explicit: a declaration for inventory
   * assigned to a client's own badge must be filed under THAT badge, and one
   * badge must not be shared across multiple client logins. FreightCode may act
   * as declarant for clients who ask it to clear on their behalf, but may not
   * file inventory-linked entries for a client who is separately badged.
   */
  cnsBadgeHolder?: boolean;
}

export interface RoutingDecision {
  transport: SubmissionTransport;
  /** Ordered, human-readable inputs to the decision. Persisted for audit (§10.4). */
  reasons: string[];
}

export class CnsRoutingError extends Error {}

/**
 * Goods locations served by CNS inventory linking.
 *
 * Sourced from configuration rather than hard-coded so additional CNS ports can
 * be enabled without a deploy. GBAULGPLGPLGP1 (London Gateway) is the EUAT
 * location supplied by CNS and already exists in the Appendix 16C dataset.
 */
export function cnsInventoryLocations(config: CnsConfig = readCnsConfig()): Set<string> {
  const extra = (process.env.CNS_INVENTORY_LOCATION_CODES || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  const codes = new Set(extra);
  if (config.goodsLocationCode) codes.add(config.goodsLocationCode);
  return codes;
}

export function isCnsInventoryLocation(
  locationId: unknown,
  config: CnsConfig = readCnsConfig(),
): boolean {
  const code = String(locationId ?? "").trim().toUpperCase();
  if (!code) return false;
  return cnsInventoryLocations(config).has(code);
}

export { normalizeUcn };

/**
 * Decide the transport for a declaration.
 *
 * Throws CnsRoutingError when the declaration is bound for a CNS inventory
 * location but cannot legitimately be filed that way — those cases must surface
 * to the operator, not silently fall back to the direct HMRC route. Falling back
 * would send a frontier declaration for an inventory-linked port straight to CDS
 * without the CSP pre-check, which the port cannot release against.
 */
export function selectDeclarationTransport(
  declaration: CnsRoutingDeclaration,
  org: CnsRoutingOrg = {},
  client: CnsRoutingClient = {},
  config: CnsConfig = readCnsConfig(),
): RoutingDecision {
  const reasons: string[] = [];
  const atCnsLocation = isCnsInventoryLocation(declaration.locationId, config);

  if (!atCnsLocation) {
    reasons.push("Goods location is not a configured CNS inventory-linked location.");
    return { transport: "hmrc_direct", reasons };
  }
  reasons.push(`Goods location ${String(declaration.locationId)} is CNS inventory-linked.`);

  // Exports are a separate follow-on phase (spec §2.2, §16).
  // `route` on FreightCode declarations normally contains the CDS customs
  // route (for example "Route 1"), not the import/export movement direction.
  // Only an explicit export marker is an export; H1/Route 1 declarations are
  // imports and must not be rejected merely because the field is overloaded.
  const flow = String(declaration.route ?? "").trim().toLowerCase();
  if (flow === "export" || flow === "exports") {
    throw new CnsRoutingError(
      "CNS inventory linking currently supports imports only. Inventory-linked exports are not implemented.",
    );
  }
  reasons.push("Declaration is an import.");

  if (!isCnsUsable(config)) {
    throw new CnsRoutingError(
      "This goods location requires CNS inventory-linked clearance, but the CNS integration is disabled or misconfigured.",
    );
  }
  reasons.push(`CNS integration enabled (${config.environment}).`);

  if (!org.cnsClearanceEnabled) {
    throw new CnsRoutingError(
      "This organisation is not enabled for FreightCode managed CNS clearance.",
    );
  }
  reasons.push("Organisation entitled to managed CNS clearance.");

  if (client.cnsBadgeHolder) {
    throw new CnsRoutingError(
      "This client holds their own CNS badge. Inventory-linked declarations must be submitted under the badge the inventory is assigned to, so FreightCode cannot file this entry under badge " +
        `${config.badgeId}.`,
    );
  }

  if (!normalizeUcn(declaration.cnsUcn)) {
    throw new CnsRoutingError(
      "A CNS UCN is required for an inventory-linked declaration at this location.",
    );
  }
  reasons.push("UCN present.");

  return { transport: "cns_inventory", reasons };
}

/**
 * Guard for amendment/cancellation: the stored route wins. A declaration created
 * through CNS is amended and cancelled through CNS, regardless of what the
 * current form state would produce.
 */
export function transportForFollowUp(storedTransport: unknown): SubmissionTransport {
  return String(storedTransport ?? "") === "cns_inventory" ? "cns_inventory" : "hmrc_direct";
}
