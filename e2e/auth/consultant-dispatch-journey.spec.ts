import { expect, test, type Page } from "@playwright/test";
import { createBrokerWithOrg, deleteTestUsers, testEmail } from "../support/clerk-users";
import { activateOrganization, signIn } from "../support/onboarding";

/**
 * The whole consultant dispatch, driven as a real signed-in broker.
 *
 * Everything here is live: a Clerk user, an active organisation, the Convex dev
 * deployment, the Request sign-off button in the real UI, an authenticated POST
 * to the BEC inbox, and a row in BEC's Supabase. Nothing is mocked, which is
 * the point — the integration tests already cover the logic, and what this
 * proves is that the two applications actually reach each other.
 *
 * Requires both servers running: FreightCode on 3000, BEC on BEC_BASE_URL.
 */

const BROKER = testEmail("consultant-dispatch");
const BEC_BASE_URL = process.env.BEC_BASE_URL ?? "http://localhost:3100";

test.describe("consultant dispatch reaches the BEC inbox", () => {
  test.afterAll(async () => {
    await deleteTestUsers(BROKER);
  });

  async function openNewAssessment(page: Page): Promise<string> {
    await page.goto("/dashboard/trade-compliance");
    await page.getByRole("button", { name: "New Assessment" }).click();

    // The reference appears in the assessment sheet header once it opens.
    const reference = page.locator("text=/EC-\\d{4}-\\d+/").first();
    await expect(reference).toBeVisible({ timeout: 30_000 });
    return ((await reference.textContent()) ?? "").trim();
  }

  test("Request sign-off creates a case the consultant can see", async ({ page }) => {
    const { orgId } = await createBrokerWithOrg(BROKER, "E2E Consultant Org");
    await signIn(page, BROKER);
    await activateOrganization(page, orgId);

    const reference = await openNewAssessment(page);
    expect(reference).toMatch(/^EC-\d{4}-\d+$/);

    // Licence management is where the sender card lives.
    await page.getByRole("button", { name: "Licence management" }).click();
    await page.getByLabel("Consultant role").selectOption("adviser");

    const signOff = page.getByRole("button", { name: "Request sign-off" });
    await expect(signOff).toBeVisible({ timeout: 20_000 });

    const dispatch = page.waitForResponse(
      (response) =>
        response.url().includes("/api/export-controls/send-to-consultant") &&
        response.request().method() === "POST",
    );
    await signOff.click();

    const response = await dispatch;
    const body = await response.json();
    expect(response.status(), JSON.stringify(body)).toBe(200);
    expect(body.deliveryStatus).toBe("delivered");
    expect(body.externalCaseId).toBeTruthy();
    expect(body).not.toHaveProperty("reviewUrl");
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toContain("/r/export/");
    expect(response.headers()["cache-control"]).toContain("no-store");

    // The sender card reports where it went, without exposing a review link.
    await expect(page.getByText(/Sent to British Export Control/i)).toBeVisible();

    // And the case exists in BEC, carrying the reference and nothing more.
    const becCase = await page.request.get(`${BEC_BASE_URL}/api/integrations/cases`);
    expect(becCase.ok(), await becCase.text()).toBe(true);
    const becCases = JSON.stringify(await becCase.json());
    expect(becCases).toContain(reference);

    // Withdrawing closes it again, which is the revocation path end to end.
    const withdraw = page.getByRole("button", { name: "Withdraw" });
    await expect(withdraw).toBeVisible();
    const revocation = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/export-controls/revoke-consultant-review") &&
        candidate.request().method() === "POST",
    );
    await withdraw.click();
    const revokeResponse = await revocation;
    expect(revokeResponse.status(), await revokeResponse.text()).toBe(200);
    await expect(withdraw).not.toBeVisible();
  });
});
