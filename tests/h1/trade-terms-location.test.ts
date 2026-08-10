import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveTradeTermsLocationId,
  validateTradeTerms,
} from "../../src/lib/wco-mapper";

/**
 * DE 4/1 second component — the location up to which the delivery terms apply.
 *
 * This previously fell back to GBFELIXSTOWE for any CIF-to-GB lane with no
 * location entered, which silently declared a place the goods were never at.
 * It surfaced on a London Gateway declaration carrying Felixstowe in DE 4/1
 * while DE 5/23 said London Gateway.
 */

describe("resolveTradeTermsLocationId", () => {
  it("returns nothing when no incoterm is set", () => {
    assert.equal(resolveTradeTermsLocationId({}), "");
  });

  it("does NOT invent a location for CIF to GB", () => {
    assert.equal(
      resolveTradeTermsLocationId({ incoterms: "CIF", destinationCountry: "GB" }),
      "",
    );
  });

  it("passes through an already-coded GB location", () => {
    assert.equal(
      resolveTradeTermsLocationId({
        incoterms: "CIF",
        destinationCountry: "GB",
        incotermLocation: "GBLGP",
      }),
      "GBLGP",
    );
  });

  it("prefixes a bare place name with the destination country", () => {
    assert.equal(
      resolveTradeTermsLocationId({
        incoterms: "CIF",
        destinationCountry: "GB",
        incotermLocation: "Felixstowe",
      }),
      "GBFELIXSTOWE",
    );
  });

  it("strips spaces and punctuation from a place name", () => {
    assert.equal(
      resolveTradeTermsLocationId({
        incoterms: "CIF",
        destinationCountry: "GB",
        incotermLocation: "London Gateway",
      }),
      "GBLONDONGATEWAY",
    );
  });
});

describe("validateTradeTerms", () => {
  it("flags a missing delivery terms code", () => {
    // DE 4/1 is mandatory because the mapper declares CustomsValuation
    // MethodCode 1. Previously this surfaced only as the opaque preflight
    // failure "no_empty_tags".
    const errors = validateTradeTerms({});
    assert.equal(errors.length, 1);
    assert.match(errors[0], /delivery terms code/i);
    assert.match(errors[0], /DE 4\/1/);
  });

  it("fails loudly when an incoterm has no location", () => {
    const errors = validateTradeTerms({
      incoterms: "CIF",
      destinationCountry: "GB",
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /DE 4\/1/);
  });

  it("passes when a location is supplied", () => {
    assert.deepEqual(
      validateTradeTerms({
        incoterms: "CIF",
        destinationCountry: "GB",
        incotermLocation: "London Gateway",
      }),
      [],
    );
  });
});
