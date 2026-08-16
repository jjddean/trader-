import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createHmrcOrganisationTestUser } from "../../../../lib/hmrc-create-test-user";
import { getAuthenticatedConvex } from "../../../../lib/hmrc-route-session";
import { resolveOrgHmrcRoutingForOrg } from "../../../../lib/hmrc-org-routing";
import { userMessageFromError } from "@/lib/convex-errors";

/** Provision (or return existing) HMRC sandbox Test User for the active practice org. */
export async function POST() {
  const clerkAuth = await auth();
  const session = await getAuthenticatedConvex(clerkAuth);
  if ("error" in session) {
    return session.error;
  }

  const orgId = clerkAuth.orgId?.trim() || "";
  if (!orgId) {
    return NextResponse.json({ error: "Select an organisation first" }, { status: 400 });
  }

  const { convex } = session;
  const orgRouting = await resolveOrgHmrcRoutingForOrg(convex, orgId);
  if ("error" in orgRouting) {
    return orgRouting.error;
  }

  if (orgRouting.hmrcMode !== "practice") {
    return NextResponse.json(
      { error: "Sandbox test users are only for test-environment organisations" },
      { status: 400 },
    );
  }

  const { api } = await import("../../../../../convex/_generated/api");

  const existing = await convex.query(api.org_hmrc.getSandboxTestUserForOrg, { orgId });
  if (existing) {
    return NextResponse.json({
      provisioned: false,
      userId: existing.userId,
      password: existing.password,
    });
  }

  try {
    const testUser = await createHmrcOrganisationTestUser();
    await convex.mutation(api.org_hmrc.saveSandboxTestUser, {
      orgId,
      userId: testUser.userId,
      password: testUser.password,
    });

    return NextResponse.json({
      provisioned: true,
      userId: testUser.userId,
      password: testUser.password,
    });
  } catch (err) {
    const message = userMessageFromError(err, "Failed to provision HMRC test user");
    console.error("[HMRC PROVISION TEST USER]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
