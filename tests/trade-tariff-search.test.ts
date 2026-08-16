import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readEntryDescription,
  readExactEntry,
  readFuzzyResults,
} from "../convex/lib/trade_tariff_search";

const EXACT = {
  data: {
    id: "1",
    type: "exact_search",
    attributes: { type: "exact_match", entry: { endpoint: "commodities", id: "8471300000" } },
  },
};

const FUZZY = {
  data: {
    id: "1",
    type: "fuzzy_search",
    attributes: {
      type: "fuzzy_match",
      goods_nomenclature_match: { chapters: [], headings: [], commodities: [] },
      reference_match: {
        chapters: [],
        headings: [],
        commodities: [
          {
            _id: "9250",
            _source: {
              title: "dining chairs, wooden",
              reference: {
                goods_nomenclature_item_id: "9403601000",
                description: "Wooden furniture of a kind used in the dining room",
              },
            },
          },
          {
            _id: "9251",
            _source: {
              title: "duplicate",
              reference: {
                goods_nomenclature_item_id: "9403601000",
                description: "Same code again",
              },
            },
          },
        ],
      },
    },
  },
};

const COMMODITY = {
  data: {
    type: "commodity",
    attributes: {
      description: "Portable automatic data-processing machines",
      formatted_description: "Portable automatic data-processing machines",
    },
  },
};

describe("trade tariff search parsing", () => {
  it("reads the exact-match entry", () => {
    assert.deepEqual(readExactEntry(EXACT), { endpoint: "commodities", id: "8471300000" });
  });

  it("returns no entry for a fuzzy payload", () => {
    assert.equal(readExactEntry(FUZZY), null);
  });

  it("reads fuzzy hits and dedupes by commodity code", () => {
    const results = readFuzzyResults(FUZZY);
    assert.equal(results.length, 1);
    assert.deepEqual(results[0], {
      code: "9403601000",
      description: "Wooden furniture of a kind used in the dining room",
      matchType: "fuzzy_match",
    });
  });

  it("returns nothing for an exact payload", () => {
    assert.deepEqual(readFuzzyResults(EXACT), []);
  });

  it("honours the result limit", () => {
    const many = {
      data: {
        attributes: {
          type: "fuzzy_match",
          reference_match: {
            commodities: Array.from({ length: 50 }, (_, i) => ({
              _source: { reference: { goods_nomenclature_item_id: `10000000${i}`, description: `d${i}` } },
            })),
          },
        },
      },
    };
    assert.equal(readFuzzyResults(many, 5).length, 5);
  });

  it("reads a commodity description", () => {
    assert.equal(readEntryDescription(COMMODITY), "Portable automatic data-processing machines");
  });

  // The old parser read `attributes.results`, a key the API never returns, so
  // every query silently produced an empty list.
  it("survives malformed and legacy-shaped payloads", () => {
    for (const bad of [null, undefined, {}, { data: {} }, { data: { attributes: {} } }, "x", 1]) {
      assert.equal(readExactEntry(bad), null);
      assert.deepEqual(readFuzzyResults(bad), []);
      assert.equal(readEntryDescription(bad), "");
    }
    assert.deepEqual(readFuzzyResults({ data: { attributes: { results: [{ a: 1 }] } } }), []);
  });
});
