import { expect, test, type Page } from "@playwright/test";

import { createFreshTestUser, deleteTestUsers, testEmail } from "../support/clerk-users";
import { expectNoFormError, fillCompanyForm, signIn } from "../support/onboarding";

/**
 * Managed Service onboarding, end to end against the dev Convex deployment.
 *
 * Covers the three production defects found in run 1:
 *   P0-1  guard messages were redacted to "Server Error" in production
 *   P0-2  re-signing up on a new Clerk account locked the user out for good
 *   P0-3  portalEmail was claimed from the typed contact field, not from Clerk
 */

const RETURNING = testEmail("managed");
const SQUATTER = testEmail("squatter");
const VICTIM = testEmail("victim");

async function completeManagedServiceForm(
  page: Page,
  options: { companyName: string; contactEmail: string },
) {
  await page.goto("/onboarding/managed-service");
  await fillCompanyForm(page, options);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Managed Service Account" }).click();
}

test.describe("Managed Service onboarding", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await Promise.all([RETURNING, SQUATTER, VICTIM].map((email) => deleteTestUsers(email)));
  });

  test("a new customer completes onboarding and lands in the portal", async ({ page }) => {
    await createFreshTestUser(RETURNING);
    await signIn(page, RETURNING);

    await completeManagedServiceForm(page, {
      companyName: "E2E Managed Ltd",
      contactEmail: RETURNING,
    });

    await expectNoFormError(page);
    await page.waitForURL("**/portal**", { timeout: 30_000 });
    expect(new URL(page.url()).pathname).toMatch(/^\/portal/);
  });

  // P0-2. Same email, brand-new Clerk user id — the client row from the previous
  // test still carries the old portalClerkId. This threw "Server Error" in prod.
  test("the same person can onboard again from a new Clerk account", async ({ page }) => {
    await createFreshTestUser(RETURNING);
    await signIn(page, RETURNING);

    await completeManagedServiceForm(page, {
      companyName: "E2E Managed Ltd (re-signup)",
      contactEmail: RETURNING,
    });

    await expectNoFormError(page);
    await page.waitForURL("**/portal**", { timeout: 30_000 });
  });

  // P0-3. The squatter types someone else's address into the contact field.
  // portalEmail must come from Clerk, so the victim stays able to onboard.
  // Separate browser contexts rather than signing out: signOut leaves the portal
  // page mid-teardown and the evaluate hangs.
  test("typing another person's email does not claim their portal", async ({ browser }) => {
    await createFreshTestUser(SQUATTER);
    const squatterContext = await browser.newContext();
    const squatterPage = await squatterContext.newPage();
    try {
      await signIn(squatterPage, SQUATTER);
      await completeManagedServiceForm(squatterPage, {
        companyName: "E2E Squatter Ltd",
        contactEmail: VICTIM,
      });
      await expectNoFormError(squatterPage);
      await squatterPage.waitForURL("**/portal**", { timeout: 30_000 });
    } finally {
      await squatterContext.close();
    }

    await createFreshTestUser(VICTIM);
    const victimContext = await browser.newContext();
    const victimPage = await victimContext.newPage();
    try {
      await signIn(victimPage, VICTIM);
      await completeManagedServiceForm(victimPage, {
        companyName: "E2E Victim Ltd",
        contactEmail: VICTIM,
      });

      await expectNoFormError(victimPage);
      await victimPage.waitForURL("**/portal**", { timeout: 30_000 });
    } finally {
      await victimContext.close();
    }
  });
});
