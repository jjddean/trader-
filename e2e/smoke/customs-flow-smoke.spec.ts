import { expect, test } from "@playwright/test";

test.describe("Customs Flow Smoke", () => {
  test("health endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
  });

  test("documents page shell is reachable", async ({ page }) => {
    const response = await page.goto("/dashboard/documents", { waitUntil: "domcontentloaded" });
    const status = response?.status() ?? 0;
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(500);
  });

  test("reports and records pages are reachable", async ({ page }) => {
    const reportsResponse = await page.goto("/dashboard/reports", { waitUntil: "domcontentloaded" });
    const reportsStatus = reportsResponse?.status() ?? 0;
    expect(reportsStatus).toBeGreaterThanOrEqual(200);
    expect(reportsStatus).toBeLessThan(500);

    const recordsResponse = await page.goto("/dashboard/records", { waitUntil: "domcontentloaded" });
    const recordsStatus = recordsResponse?.status() ?? 0;
    expect(recordsStatus).toBeGreaterThanOrEqual(200);
    expect(recordsStatus).toBeLessThan(500);
  });
});
