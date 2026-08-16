import { expect, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";

/**
 * Sign-in token strategy, not password: this Clerk instance answers password
 * sign-ins with `needs_client_trust`, and @clerk/testing's password path then
 * calls setActive with a null session and returns silently signed-out.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.loaded({ page });
  await clerk.signIn({ page, emailAddress: email });
}

export interface CompanyFormValues {
  companyName: string;
  contactEmail: string;
  eori?: string;
}

/** Fills the shared onboarding company form. Does not submit. */
export async function fillCompanyForm(page: Page, values: CompanyFormValues): Promise<void> {
  // The onboarding pages render a loading state until Clerk reports the session.
  // Without this the first field occasionally resolves before the form mounts.
  await page.locator("#companyName").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("#companyName").fill(values.companyName);

  await page.locator("#legalEntityType").click();
  await page.getByRole("option", { name: "Limited company" }).click();
  await page.locator("#companyRegistrationNumber").fill("12345678");

  await page.locator("#addressLine").fill("475 Green Lanes");
  await page.locator("#postcode").fill("N4 1AJ");
  await page.locator("#city").fill("London");

  if (values.eori) {
    await page.locator("#eori").fill(values.eori);
  }

  await page.locator("#contactName").fill("E2E Test Contact");
  await page.locator("#contactJobTitle").fill("Director");
  await page.locator("#contactEmail").fill(values.contactEmail);
}

/**
 * Asserts the form reported no failure. A redacted "Server Error" is the exact
 * production symptom run 1 fixed, so it gets its own assertion for a clear diff.
 */
export async function expectNoFormError(page: Page): Promise<void> {
  const box = page.locator("div.bg-red-50");
  if (await box.count()) {
    const text = (await box.first().innerText()).trim();
    expect(text, "onboarding surfaced an error").not.toMatch(/server error/i);
    expect(text, "onboarding surfaced an error").toBe("");
  }
}
