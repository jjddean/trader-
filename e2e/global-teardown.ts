import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClerkClient } from "@clerk/backend";

/**
 * Deletes the organisations the auth journeys create.
 *
 * Clerk development instances are capped at 50 organisations on the free tier.
 * The suite created 2–3 per run and never removed them, so by 2026-08-17 the
 * instance sat at exactly 50 and `createOrganization` started returning 403
 * Forbidden — failing cross-tenant-isolation and broker-onboarding for reasons
 * that had nothing to do with the application.
 *
 * Only names the specs use are removed. Real organisations are left alone.
 */
const TEST_ORG_NAME = /^E2E /;

export default async function globalTeardown() {
  loadEnv({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });

  const secretKey = process.env.CLERK_SECRET_KEY ?? "";
  if (!secretKey.startsWith("sk_test_")) {
    // globalSetup already refuses to run against production; stay silent here
    // rather than deleting anything on an instance we do not recognise.
    return;
  }

  const clerk = createClerkClient({ secretKey });

  try {
    const { data } = await clerk.organizations.getOrganizationList({ limit: 500 });
    const stale = data.filter((org) => TEST_ORG_NAME.test(org.name));
    if (stale.length === 0) return;

    let removed = 0;
    for (const org of stale) {
      try {
        await clerk.organizations.deleteOrganization(org.id);
        removed += 1;
      } catch (err) {
        console.warn(`[e2e teardown] could not delete ${org.name} (${org.id})`, err);
      }
    }
    console.log(`[e2e teardown] removed ${removed}/${stale.length} test organisations`);
  } catch (err) {
    // Never fail a green run on cleanup.
    console.warn("[e2e teardown] organisation cleanup skipped", err);
  }
}
