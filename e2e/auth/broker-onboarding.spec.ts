import { expect, test, type Page } from "@playwright/test";

import { createFreshTestUser, deleteTestUsers, testEmail } from "../support/clerk-users";
import { expectNoFormError, fillCompanyForm, signIn } from "../support/onboarding";

/**
 * Broker onboarding, end to end against the dev Convex deployment.
 * Broker requires a valid GB/XI EORI and the CDS subscription confirmation,
 * then hands off to Clerk's organisation session task.
 */

const BROKER = testEmail("broker");

async function submitBrokerForm(page: Page, companyName: string) {
  await page.goto("/onboarding/broker");
  await fillCompanyForm(page, {
    companyName,
    contactEmail: BROKER,
    eori: "GB123456789012",
  });

  // Broker renders two checkboxes: CDS confirmation, then Terms.
  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(2);
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();

  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe("Broker onboarding", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await deleteTestUsers(BROKER);
  });

  test("a new broker completes onboarding and reaches organisation setup", async ({ page }) => {
    await createFreshTestUser(BROKER);
    await signIn(page, BROKER);

    await submitBrokerForm(page, "E2E Broker Ltd");

    await expectNoFormError(page);
    await page.waitForURL("**/session-tasks/choose-organization**", { timeout: 30_000 });
  });

  // Broker onboarding is re-runnable: the profile is upserted by clerkId, so a
  // user who abandons org creation and comes back must not be blocked.
  test("a returning broker can resubmit without being blocked", async ({ page }) => {
    await signIn(page, BROKER);

    await submitBrokerForm(page, "E2E Broker Ltd (resubmit)");

    await expectNoFormError(page);
    await page.waitForURL("**/session-tasks/choose-organization**", { timeout: 30_000 });
  });

  test("an invalid EORI is rejected with a readable message, not a server error", async ({
    page,
  }) => {
    await signIn(page, BROKER);
    await page.goto("/onboarding/broker");

    await fillCompanyForm(page, { companyName: "E2E Bad EORI Ltd", contactEmail: BROKER });

    // Bypass the HTML pattern so the server-side guard is the thing under test.
    await page.locator("#eori").evaluate((el) => el.removeAttribute("pattern"));
    await page.locator("#eori").fill("FR123456789012");

    const checkboxes = page.getByRole("checkbox");
    await checkboxes.nth(0).check();
    await checkboxes.nth(1).check();
    await page.getByRole("button", { name: "Continue" }).click();

    const box = page.locator("div.bg-red-50");
    await expect(box).toBeVisible({ timeout: 15_000 });
    await expect(box).toContainText("EORI number must start with GB or XI");
    await expect(box).not.toContainText(/server error/i);
  });
});
