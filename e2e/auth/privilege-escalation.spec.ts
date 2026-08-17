import { expect, test, type Page } from "@playwright/test";

import { createFreshTestUser, deleteTestUsers, testEmail } from "../support/clerk-users";
import { signIn } from "../support/onboarding";

/**
 * users.syncUser accepts `role` and `email` from the caller and passes both to
 * resolveUserRole, which returns "admin" for either an "admin" role string or an
 * address in ADMIN_EMAILS. The result is written to users.role, and
 * getCurrentUserRole / requireAdmin trust that row.
 *
 * This drives the real Convex HTTP API with a real Clerk token — no mocking.
 */

const ATTACKER = testEmail("escalation");

/** Call a Convex function over HTTP with the browser's Clerk token. */
async function callConvex(
  page: Page,
  kind: "mutation" | "query",
  path: string,
  args: Record<string, unknown>,
): Promise<{ status: string; value?: unknown; errorMessage?: string }> {
  return await page.evaluate(
    async ({ kind, path, args }) => {
      const clerk = (
        window as unknown as {
          Clerk?: { session?: { getToken: (o: { template: string }) => Promise<string> } };
        }
      ).Clerk;
      const token = await clerk?.session?.getToken({ template: "convex" });
      const base = (window as unknown as { __CONVEX_URL__?: string }).__CONVEX_URL__;
      const url = base ?? "";
      const response = await fetch(`${url}/api/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ path, args, format: "json" }),
      });
      return (await response.json()) as { status: string; value?: unknown; errorMessage?: string };
    },
    { kind, path, args },
  );
}

test.describe("privilege escalation via syncUser", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await deleteTestUsers(ATTACKER);
  });

  test("a signed-in user cannot make themselves admin", async ({ page }) => {
    await createFreshTestUser(ATTACKER);
    await signIn(page, ATTACKER);

    // Expose the deployment URL the app is already configured with.
    await page.addInitScript(() => {
      (window as unknown as { __CONVEX_URL__?: string }).__CONVEX_URL__ =
        (window as unknown as { __NEXT_DATA__?: unknown }) && "";
    });
    await page.goto("/");

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
    expect(convexUrl, "NEXT_PUBLIC_CONVEX_URL must be set").not.toBe("");
    await page.evaluate((url) => {
      (window as unknown as { __CONVEX_URL__?: string }).__CONVEX_URL__ = url;
    }, convexUrl);

    // Control: prove the harness actually reaches Convex with a valid token.
    // Without this, both assertions below would pass on a broken transport and
    // the test would claim safety it never tested.
    const control = await callConvex(page, "query", "users:current", {});
    expect(
      control.status,
      `harness cannot reach Convex: ${JSON.stringify(control).slice(0, 300)}`,
    ).toBe("success");
    // value may be null (no users row yet); reaching Convex is the point.

    // Baseline: an admin-only query must refuse this user.
    const before = await callConvex(page, "query", "audit:getRecentLogs", {});
    console.log("BEFORE", JSON.stringify(before).slice(0, 200));
    expect(before.status, "user should not start as admin").toBe("error");

    // The attack: claim the admin role while syncing.
    const sync = await callConvex(page, "mutation", "users:syncUser", {
      email: ATTACKER,
      role: "admin",
    });
    console.log("SYNC", JSON.stringify(sync).slice(0, 200));

    // If the claim stuck, admin-only data is now readable.
    const after = await callConvex(page, "query", "audit:getRecentLogs", {});
    console.log("AFTER", JSON.stringify(after).slice(0, 300));
    expect(
      after.status,
      "syncUser accepted a client-supplied admin role — privilege escalation",
    ).toBe("error");
  });
});
