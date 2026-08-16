import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConvexError } from "convex/values";

import { userError, unauthenticatedError } from "../convex/lib/user_errors";
import {
  ApiError,
  GENERIC_ERROR_MESSAGE,
  userErrorCode,
  userMessageFromError,
} from "../src/lib/convex-errors";

describe("user-facing Convex errors", () => {
  it("carries the message in ConvexError data, which production does not redact", () => {
    const err = userError("invalid_eori", "EORI number must start with GB or XI");
    assert.ok(err instanceof ConvexError);
    assert.deepEqual(err.data, {
      kind: "user",
      code: "invalid_eori",
      message: "EORI number must start with GB or XI",
    });
  });

  it("round-trips through the client helper", () => {
    const err = userError("terms_not_accepted", "You must accept the Terms of Service");
    assert.equal(userMessageFromError(err), "You must accept the Terms of Service");
    assert.equal(userErrorCode(err), "terms_not_accepted");
  });

  it("gives the unauthenticated error a stable code", () => {
    assert.equal(userErrorCode(unauthenticatedError()), "unauthenticated");
  });

  it("hides internal Errors behind the generic message", () => {
    const internal = new Error("Uncaught TypeError: cannot read _id of undefined");
    assert.equal(userMessageFromError(internal), GENERIC_ERROR_MESSAGE);
    assert.equal(userErrorCode(internal), null);
  });

  it("hides ConvexErrors that are not tagged as user-facing", () => {
    const raw = new ConvexError({ table: "clients", id: "abc123" });
    assert.equal(userMessageFromError(raw), GENERIC_ERROR_MESSAGE);
    assert.equal(userErrorCode(raw), null);
  });

  it("hides a plain-string ConvexError payload", () => {
    assert.equal(userMessageFromError(new ConvexError("boom")), GENERIC_ERROR_MESSAGE);
  });

  // Route-authored messages must survive. Replacing them with the generic
  // fallback told a broker "could not be updated" when portal access was in fact
  // enabled and only the invite email had failed.
  it("keeps a message our own API route wrote", () => {
    const err = new ApiError("Portal access was enabled, but the invite email failed.");
    assert.equal(
      userMessageFromError(err),
      "Portal access was enabled, but the invite email failed.",
    );
  });

  it("falls back when an ApiError carries no message", () => {
    assert.equal(userMessageFromError(new ApiError("")), GENERIC_ERROR_MESSAGE);
    assert.equal(userMessageFromError(new ApiError("   ")), GENERIC_ERROR_MESSAGE);
  });

  it("still hides plain Errors, which may carry internal detail", () => {
    assert.equal(userMessageFromError(new Error("connect ECONNREFUSED")), GENERIC_ERROR_MESSAGE);
  });

  it("handles non-error throwables", () => {
    assert.equal(userMessageFromError(undefined), GENERIC_ERROR_MESSAGE);
    assert.equal(userMessageFromError("string throw"), GENERIC_ERROR_MESSAGE);
    assert.equal(userErrorCode(null), null);
  });
});
