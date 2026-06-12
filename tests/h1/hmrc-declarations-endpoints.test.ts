import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  declarationsEndpointPath,
  declarationsEndpointUrl,
} from "../../src/lib/hmrc-config";

describe("HMRC declarations API endpoints", () => {
  it("maps submit/cancel/amend to HMRC paths", () => {
    assert.equal(declarationsEndpointPath("submit"), "/customs/declarations");
    assert.equal(
      declarationsEndpointPath("cancel"),
      "/customs/declarations/cancellation-requests",
    );
    assert.equal(declarationsEndpointPath("amend"), "/customs/declarations/amend");
  });

  it("builds full URLs from base", () => {
    const base = "https://test-api.service.hmrc.gov.uk";
    assert.equal(
      declarationsEndpointUrl(base, "amend"),
      "https://test-api.service.hmrc.gov.uk/customs/declarations/amend",
    );
  });
});
