import { expect, test, type Page } from "@playwright/test";

import { createBrokerWithOrg, deleteTestUsers, testEmail } from "../support/clerk-users";
import { activateOrganization, signIn } from "../support/onboarding";

/**
 * "Manipulating a client-side ID must never expose another organisation's data."
 *
 * Two brokers in separate Clerk organisations. Org A creates a declaration; org B
 * is then handed its id and tries to read it through the real UI routes. Nothing
 * here mocks the boundary — B holds a genuine session and a genuine id.
 */

const ORG_A = testEmail("tenant-a");
const ORG_B = testEmail("tenant-b");

let declarationIdA = "";

async function asBroker(page: Page, email: string, orgId: string) {
  await signIn(page, email);
  await activateOrganization(page, orgId);
}

async function createDeclaration(page: Page): Promise<string> {
  await page.goto("/dashboard/declarations");
  await page.getByRole("button", { name: "New Declaration" }).click();
  await page.locator("#origin").click();
  await page.getByRole("option").first().click();
  await page.locator("#hsCode").fill("8471300000");
  await page.locator("#description").fill("Cross-tenant probe");
  await page.getByRole("button", { name: "Create Declaration" }).click();
  await page.waitForURL(/\/dashboard\/declarations\/[a-z0-9]+$/, { timeout: 30_000 });
  return page.url().split("/").pop() ?? "";
}

test.describe("cross-tenant isolation", () => {
  test.setTimeout(180_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await Promise.all([ORG_A, ORG_B].map((email) => deleteTestUsers(email)));
  });

  test("org A creates a declaration", async ({ browser }) => {
    const { orgId } = await createBrokerWithOrg(ORG_A, "E2E Tenant A");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await asBroker(page, ORG_A, orgId);
      declarationIdA = await createDeclaration(page);
      expect(declarationIdA).toMatch(/^[a-z0-9]+$/);
    } finally {
      await context.close();
    }
  });

  test("org B cannot read org A's declaration by id", async ({ browser }) => {
    expect(declarationIdA, "org A must have created a declaration").not.toBe("");

    const { orgId } = await createBrokerWithOrg(ORG_B, "E2E Tenant B");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await asBroker(page, ORG_B, orgId);

      // The exact URL org A sees, opened by a different organisation.
      await page.goto(`/dashboard/declarations/${declarationIdA}`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3_000);

      const body = (await page.locator("body").innerText()).toLowerCase();

      // The probe description is org A's data. It must not render for org B.
      expect(body).not.toContain("cross-tenant probe");
      // Nor may an error leak internals about a record B cannot see.
      expect(body).not.toMatch(/server error|\{"kind":"user"/);
    } finally {
      await context.close();
    }
  });

  test("org B cannot read it through the status route either", async ({ browser }) => {
    expect(declarationIdA).not.toBe("");

    const { orgId } = await createBrokerWithOrg(ORG_B, "E2E Tenant B");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await asBroker(page, ORG_B, orgId);
      await page.goto(`/dashboard/declarations/${declarationIdA}/status`);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3_000);

      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("cross-tenant probe");
      expect(body).not.toMatch(/server error|\{"kind":"user"/);
    } finally {
      await context.close();
    }
  });

  test("org A's declaration does not appear in org B's list", async ({ browser }) => {
    const { orgId } = await createBrokerWithOrg(ORG_B, "E2E Tenant B");
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await asBroker(page, ORG_B, orgId);
      await page.goto("/dashboard/declarations");
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(3_000);

      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("cross-tenant probe");
    } finally {
      await context.close();
    }
  });
});
