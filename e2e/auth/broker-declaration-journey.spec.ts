import { expect, test, type Page } from "@playwright/test";

import { createBrokerWithOrg, deleteTestUsers, testEmail } from "../support/clerk-users";
import { activateOrganization, signIn } from "../support/onboarding";

/**
 * Broker journey: sign in → declaration → items → status page.
 *
 * Stops before HMRC submission. The submit, amend and cancel routes carry the
 * duplicate-filing guards added in this work, and exercising them for real means
 * filing at CDS — not something a test suite should do.
 *
 * Requires an already-onboarded broker with an active Clerk organisation, so it
 * skips rather than fails when one is not configured.
 */

const BROKER = testEmail("declaration");
let brokerOrgId = "";

async function openDeclarations(page: Page) {
  await page.goto("/dashboard/declarations");
  await page.waitForLoadState("domcontentloaded");
}

/** True when the signed-in user reached the broker dashboard rather than onboarding. */
async function reachedDashboard(page: Page): Promise<boolean> {
  await page.waitForTimeout(2_000);
  return new URL(page.url()).pathname.startsWith("/dashboard");
}

test.describe("Broker declaration journey", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await deleteTestUsers(BROKER);
  });

  test("a broker creates a declaration and reaches its detail page", async ({ page }) => {
    brokerOrgId = (await createBrokerWithOrg(BROKER)).orgId;
    await signIn(page, BROKER);
    await activateOrganization(page, brokerOrgId);
    await openDeclarations(page);

    test.skip(
      !(await reachedDashboard(page)),
      "needs an onboarded broker with an active Clerk org; none configured for e2e",
    );

    await page.getByRole("button", { name: "New Declaration" }).click();

    await page.locator("#origin").click();
    await page.getByRole("option").first().click();
    await page.locator("#hsCode").fill("8471300000");
    await page.locator("#description").fill("E2E portable data processing machine");

    await page.getByRole("button", { name: "Create Declaration" }).click();

    // Landing on the detail page proves the row was created and is readable.
    await page.waitForURL(/\/dashboard\/declarations\/[a-z0-9]+$/, { timeout: 30_000 });
    await expect(page.locator("div.bg-red-50")).toHaveCount(0);
  });

  test("the status page renders without a server error", async ({ page }) => {
    await signIn(page, BROKER);
    await activateOrganization(page, brokerOrgId);
    await openDeclarations(page);

    test.skip(!(await reachedDashboard(page)), "needs an onboarded broker");

    const firstRow = page.locator("tbody tr").first();
    test.skip((await firstRow.count()) === 0, "no declarations to open");

    await firstRow.click();
    await page.waitForURL(/\/dashboard\/declarations\/[a-z0-9]+/, { timeout: 30_000 });

    await page.goto(`${page.url().replace(/\/status$/, "")}/status`);
    await page.waitForLoadState("domcontentloaded");

    // The status page reads the notification timeline, which this work changed.
    await expect(page.getByText(/Server Error/i)).toHaveCount(0);
    await expect(page.getByText(/\{"kind":"user"/)).toHaveCount(0);
  });
});
