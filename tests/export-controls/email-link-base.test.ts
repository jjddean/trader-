import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  emailLinkBaseUrl,
  emailPathUrl,
  secureCredentialPathUrl,
} from "../../src/lib/export-controls/email-link-base";

describe("emailLinkBaseUrl", () => {
  const prevFrom = process.env.RESEND_FROM_EMAIL;
  const prevApp = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (prevFrom === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prevFrom;
    if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevApp;
  });

  it("prefers APP_URL (Clerk canonical) over Resend From domain", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    assert.equal(emailLinkBaseUrl(), "https://www.freightcode.co.uk");
    assert.equal(emailPathUrl("/r/export/abc"), "https://www.freightcode.co.uk/r/export/abc");
  });

  it("falls back to Resend From host when APP_URL unset", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    assert.equal(emailLinkBaseUrl(), "https://freightcode.co.uk");
  });

  it("ignores resend.dev From and uses APP_URL", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <onboarding@resend.dev>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    assert.equal(emailLinkBaseUrl(), "https://www.freightcode.co.uk");
  });

  it("uses localhost request host even when From is production", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    const request = new Request("http://localhost:3000/api/export-controls/send-to-consultant", {
      headers: { host: "localhost:3000" },
    });
    assert.equal(emailLinkBaseUrl(request), "http://localhost:3000");
    assert.equal(emailPathUrl("/r/export/abc", request), "http://localhost:3000/r/export/abc");
  });

  it("uses local APP_URL when no request", () => {
    process.env.RESEND_FROM_EMAIL = "freightcode <info@freightcode.co.uk>";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    assert.equal(emailLinkBaseUrl(), "http://localhost:3000");
  });

  it("uses only the configured canonical origin for credential links", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk";
    const poisoned = new Request("https://attacker.example/api/consultant-partner/handoff", {
      headers: {
        host: "attacker.example",
        "x-forwarded-host": "attacker.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(
      secureCredentialPathUrl("/r/export/h/code", poisoned),
      "https://www.freightcode.co.uk/r/export/h/code",
    );
  });

  it("rejects non-local request-host fallback for credential links", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request("https://attacker.example/api/consultant-partner/handoff");
    assert.throws(() => secureCredentialPathUrl("/r/export/h/code", request));
  });

  it("rejects a configured credential origin containing a path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.freightcode.co.uk/app";
    assert.throws(() => secureCredentialPathUrl("/r/export/h/code"));
  });
});
