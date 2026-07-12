import { afterEach, describe, expect, it } from "vitest";
import { emailLinkBaseUrl, emailPathUrl } from "../../src/lib/export-controls/email-link-base";

describe("emailLinkBaseUrl", () => {
  const prevFrom = process.env.RESEND_FROM_EMAIL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (prevFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prevFrom;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  });

  it("matches Resend From domain (apex), not www APP_URL", () => {
    process.env.RESEND_FROM_EMAIL = "Freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    expect(emailLinkBaseUrl()).toBe("https://freightcode.co.uk");
    expect(emailPathUrl("/r/export/abc")).toBe("https://freightcode.co.uk/r/export/abc");
  });

  it("falls back to APP_URL when From is resend.dev", () => {
    process.env.RESEND_FROM_EMAIL = "Freightcode <onboarding@resend.dev>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    expect(emailLinkBaseUrl()).toBe("https://www.freightcode.co.uk");
  });
});
