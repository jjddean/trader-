import { expect, test, type Page } from "@playwright/test";

import { createFreshTestUser, deleteTestUsers, testEmail } from "../support/clerk-users";
import { expectNoFormError, fillCompanyForm, signIn } from "../support/onboarding";

/**
 * Managed Service customer journey across the portal, plus the portal half of
 * the isolation question: a portal client holds a real session, so every route
 * must scope to their own client record and nothing else.
 */

const CLIENT_A = testEmail("portal-a");
const CLIENT_B = testEmail("portal-b");

const PORTAL_ROUTES = [
  "/portal/dashboard",
  "/portal/declarations",
  "/portal/documents",
  "/portal/messages",
  "/portal/charges",
  "/portal/company",
  "/portal/compliance",
];

async function onboard(page: Page, email: string, companyName: string) {
  await signIn(page, email);
  await page.goto("/onboarding/managed-service");
  await fillCompanyForm(page, { companyName, contactEmail: email });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Managed Service Account" }).click();
  await expectNoFormError(page);
  await page.waitForURL("**/portal**", { timeout: 30_000 });
}

test.describe("portal journey", () => {
  test.setTimeout(180_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await Promise.all([CLIENT_A, CLIENT_B].map((email) => deleteTestUsers(email)));
  });

  test("every portal route renders for a signed-in client", async ({ page }) => {
    await createFreshTestUser(CLIENT_A);
    await onboard(page, CLIENT_A, "E2E Portal Alpha Ltd");

    for (const route of PORTAL_ROUTES) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const body = await page.locator("body").innerText();

      // No raw error payload, and not bounced back to sign-in.
      expect(body, `${route} surfaced an error`).not.toMatch(/Server Error|\{"kind":"user"/);
      expect(new URL(page.url()).pathname, `${route} redirected`).not.toContain("/sign-in");
    }
  });

  test("a portal client sees their own company, not another's", async ({ browser }) => {
    await createFreshTestUser(CLIENT_B);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    try {
      await onboard(pageB, CLIENT_B, "E2E Portal Bravo Ltd");
      await pageB.goto("/portal/company");
      await pageB.waitForLoadState("domcontentloaded");
      await pageB.waitForTimeout(2_000);

      const body = await pageB.locator("body").innerText();
      expect(body).toContain("E2E Portal Bravo Ltd");
      // Client A's company must never appear in B's portal.
      expect(body).not.toContain("E2E Portal Alpha Ltd");
    } finally {
      await contextB.close();
    }
  });

  test("the portal refuses a signed-in user with no client record", async ({ browser }) => {
    const stranger = testEmail("portal-stranger");
    await createFreshTestUser(stranger);

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await signIn(page, stranger);
      await page.goto("/portal/documents");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3_000);

      const body = await page.locator("body").innerText();
      // Either onboarding, or the explicit no-access state — never another
      // client's documents and never a raw error.
      expect(body).not.toMatch(/Server Error|\{"kind":"user"/);
      expect(body).not.toContain("E2E Portal Alpha Ltd");
      expect(body).not.toContain("E2E Portal Bravo Ltd");
    } finally {
      await context.close();
      await deleteTestUsers(stranger);
    }
  });
});
