import { NextResponse } from "next/server";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  assertOrgHmrcRoutingAllowed,
  resolveHmrcContext,
  type HmrcOrgMode,
  type ResolvedHmrcContext,
} from "./hmrc-context";

export type OrgHmrcRoutingResult =
  | { error: NextResponse }
  | { hmrcMode: HmrcOrgMode; hmrcContext: ResolvedHmrcContext };

export async function resolveOrgHmrcRoutingForDeclaration(
  convex: ConvexHttpClient,
  declarationId: Id<"declarations">,
): Promise<OrgHmrcRoutingResult> {
  const orgRouting = await convex.query(api.org_hmrc.getModeForDeclaration, { declarationId });
  const hmrcMode = orgRouting?.hmrcMode ?? "practice";
  const routingBlock = assertOrgHmrcRoutingAllowed(hmrcMode);
  if (routingBlock) {
    return { error: NextResponse.json({ error: routingBlock }, { status: 403 }) };
  }
  return { hmrcMode, hmrcContext: resolveHmrcContext(hmrcMode) };
}

export async function resolveOrgHmrcRoutingForOrg(
  convex: ConvexHttpClient,
  orgId: string | null | undefined,
): Promise<OrgHmrcRoutingResult> {
  const trimmed = orgId?.trim() || "";
  const hmrcMode: HmrcOrgMode = trimmed
    ? (await convex.query(api.org_hmrc.getModeForOrg, { orgId: trimmed })).hmrcMode
    : "practice";
  const routingBlock = assertOrgHmrcRoutingAllowed(hmrcMode);
  if (routingBlock) {
    return { error: NextResponse.json({ error: routingBlock }, { status: 403 }) };
  }
  return { hmrcMode, hmrcContext: resolveHmrcContext(hmrcMode) };
}
