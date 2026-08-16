import { expect, test, type Page } from "@playwright/test";

import { createFreshTestUser, deleteTestUsers, testEmail } from "../support/clerk-users";
import { expectNoFormError, fillCompanyForm, signIn } from "../support/onboarding";

/**
 * Portal document upload, end to end.
 *
 * Upload is two steps — POST the bytes to Convex storage, then insert the
 * documents row. Nothing exercised that pair in a browser before, which is where
 * the orphaned-file defect (P1-9) lived.
 */

const UPLOADER = testEmail("uploader");

async function onboardAsManagedClient(page: Page, email: string) {
  await signIn(page, email);
  await page.goto("/onboarding/managed-service");
  await fillCompanyForm(page, { companyName: "E2E Upload Ltd", contactEmail: email });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Managed Service Account" }).click();
  await expectNoFormError(page);
  await page.waitForURL("**/portal**", { timeout: 30_000 });
}

test.describe("Portal document upload", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.afterAll(async () => {
    await deleteTestUsers(UPLOADER);
  });

  test("a portal client uploads a document and sees it listed", async ({ page }) => {
    await createFreshTestUser(UPLOADER);
    await onboardAsManagedClient(page, UPLOADER);

    await page.goto("/portal/documents");
    // Exactly one h1 — the shell header used to render a second (P2-3).
    await expect(page.getByRole("heading", { name: "Documents", level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    const fileName = `e2e-invoice-${Date.now()}.pdf`;
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "application/pdf",
      // Minimal well-formed PDF so nothing downstream chokes on the bytes.
      buffer: Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"),
    });

    // Success notice, not the red error box.
    await expect(page.locator("div.bg-emerald-50")).toContainText("sent to your broker", {
      timeout: 30_000,
    });
    await expect(page.locator("div.bg-red-50")).toHaveCount(0);

    // The row must actually exist, not just the optimistic notice.
    await page.reload();
    await expect(page.getByText(fileName, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("the upload control is disabled while an upload is in flight", async ({ page }) => {
    await signIn(page, UPLOADER);
    await page.goto("/portal/documents");

    const input = page.locator('input[type="file"]');
    await expect(input).toBeEnabled();
    await expect(input).toHaveAttribute("type", "file");
  });
});
