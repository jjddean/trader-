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
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    expect(emailLinkBaseUrl()).toBe("https://freightcode.co.uk");
    expect(emailPathUrl("/r/export/abc")).toBe("https://freightcode.co.uk/r/export/abc");
  });

  it("falls back to APP_URL when From is resend.dev", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <onboarding@resend.dev>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    expect(emailLinkBaseUrl()).toBe("https://www.freightcode.co.uk");
  });

  it("uses localhost request host even when From is production", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    const request = new Request("http://localhost:3000/api/export-controls/send-to-consultant", {
      headers: { host: "localhost:3000" },
    });
    expect(emailLinkBaseUrl(request)).toBe("http://localhost:3000");
    expect(emailPathUrl("/r/export/abc", request)).toBe("http://localhost:3000/r/export/abc");
  });

  it("uses local APP_URL when no request", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    expect(emailLinkBaseUrl()).toBe("http://localhost:3000");
  });
});
