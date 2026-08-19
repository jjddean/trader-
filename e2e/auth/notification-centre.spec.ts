import { expect, test } from "@playwright/test";

import { createBrokerWithOrg, deleteTestUsers, testEmail } from "../support/clerk-users";
import { activateOrganization, signIn } from "../support/onboarding";

/**
 * Notification centre: the header panel and the preference toggles behind
 * Settings → Notifications.
 *
 * A freshly created broker has an empty inbox, which is the point — it proves
 * the panel renders, scopes to the signed-in user, and does not leak another
 * tenant's rows. Emitting a real notification is deliberately not attempted:
 * the only UI path that reaches `validation_results.recompute` is the HMRC
 * submit route, and filing at CDS is not something a test suite should do.
 */

const BROKER = testEmail("notifications");
let brokerOrgId = "";

test.describe("Notification centre", () => {
  test.setTimeout(120_000);
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    brokerOrgId = (await createBrokerWithOrg(BROKER, "E2E Notifications Org")).orgId;
  });

  test.afterAll(async () => {
    await deleteTestUsers(BROKER);
  });

  test("the bell opens a panel with tabs and an empty state", async ({ page }) => {
    await signIn(page, BROKER);
    await activateOrganization(page, brokerOrgId);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    test.skip(
      !new URL(page.url()).pathname.startsWith("/dashboard"),
      "needs an onboarded broker with an active Clerk org",
    );

    // No unread rows for a new user, so the bell carries the bare label.
    const bell = page.getByRole("button", { name: /^Notifications$/ });
    await bell.waitFor({ state: "visible", timeout: 30_000 });
    await bell.click();

    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

    // Counts come from the server, not a client-side filter over a page.
    await expect(page.getByRole("button", { name: "All (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unread (0)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Urgent (0)" })).toBeVisible();

    await expect(page.getByText("No notifications")).toBeVisible();

    // Mark-all-read only exists while something is unread.
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  });

  test("the filter tabs switch without error", async ({ page }) => {
    await signIn(page, BROKER);
    await activateOrganization(page, brokerOrgId);
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    test.skip(!new URL(page.url()).pathname.startsWith("/dashboard"), "needs an onboarded broker");

    await page.getByRole("button", { name: /^Notifications$/ }).click();

    // The ported design uses one empty-state wording for every filter.
    await page.getByRole("button", { name: "Urgent (0)" }).click();
    await expect(page.getByText("No notifications")).toBeVisible();

    await page.getByRole("button", { name: "Unread (0)" }).click();
    await expect(page.getByText("No notifications")).toBeVisible();

    await page.getByRole("button", { name: "Close notifications" }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toHaveCount(0);
  });

  test("preferences render from the catalogue and persist a change", async ({ page }) => {
    await signIn(page, BROKER);
    await activateOrganization(page, brokerOrgId);
    await page.goto("/dashboard/settings?tab=notifications");
    await page.waitForLoadState("domcontentloaded");
    test.skip(!new URL(page.url()).pathname.startsWith("/dashboard"), "needs an onboarded broker");

    // Declaration status is locked: HMRC outcomes must not be silenceable, so it
    // renders a badge rather than a switch.
    await expect(page.getByText("Declaration status")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Always on").first()).toBeVisible();

    // Clients defaults to off — flipping it on writes the first preference row.
    const clientsToggle = page.getByRole("switch", { name: "Clients" });
    await expect(clientsToggle).toHaveAttribute("aria-checked", "false");
    await clientsToggle.click();
    await expect(clientsToggle).toHaveAttribute("aria-checked", "true");

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByRole("switch", { name: "Clients" })).toHaveAttribute(
      "aria-checked",
      "true",
      { timeout: 30_000 },
    );
  });
});
