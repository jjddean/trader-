import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  canonicalControlListEntries,
  findEntry,
  type ControlListEntry,
  type ControlListSnapshot,
} from "../../src/lib/export-controls/control-list";

function entry(entryCode: string, fullText: string): ControlListEntry {
  return {
    entryCode,
    entryType: "dual_use",
    category: "Category 1",
    title: fullText,
    fullText,
    pageStart: 1,
    pageEnd: 1,
    chunks: [],
    notes: [],
    exclusions: [],
    crossRefs: [],
  };
}

describe("canonicalControlListEntries", () => {
  it("keeps one row per code and prefers the most complete entry", () => {
    const fragment = entry("1C111", "continuation fragment");
    const complete = entry(
      "1C111",
      "complete control-list entry with substantially more text",
    );
    const other = entry("1C112", "another entry");

    const canonical = canonicalControlListEntries([fragment, complete, other]);

    assert.equal(canonical.length, 2);
    assert.equal(canonical[0].fullText, complete.fullText);
    assert.deepEqual(canonical[0].additionalOccurrences, [
      {
        title: fragment.title,
        fullText: fragment.fullText,
        pageStart: fragment.pageStart,
        pageEnd: fragment.pageEnd,
        notes: fragment.notes,
        exclusions: fragment.exclusions,
        crossRefs: fragment.crossRefs,
      },
    ]);
    assert.equal(canonical[1].fullText, other.fullText);
  });

  it("makes detail lookup use the same canonical entry", () => {
    const fragment = entry("1C111", "fragment");
    const complete = entry("1C111", "complete control-list entry");
    const snapshot = {
      entries: [fragment, complete],
    } as ControlListSnapshot;

    const resolved = findEntry(snapshot, "1c111");
    assert.equal(resolved?.fullText, complete.fullText);
    assert.equal(resolved?.additionalOccurrences?.[0]?.fullText, fragment.fullText);
  });

  it("preserves every parsed occurrence from the real snapshot", () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL(
          "../../data/export-controls/v2025-12-16.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as ControlListSnapshot;
    const canonical = canonicalControlListEntries(snapshot.entries);
    const original = snapshot.entries.filter(
      (item) => item.entryCode.toUpperCase() === "1C350",
    );
    const resolved = canonical.find(
      (item) => item.entryCode.toUpperCase() === "1C350",
    );

    assert.ok(resolved);
    assert.equal(original.length, 3);
    assert.equal(resolved.pageStart, 147);
    assert.equal(resolved.additionalOccurrences?.length, 2);
    assert.deepEqual(
      new Set([
        resolved.fullText,
        ...(resolved.additionalOccurrences ?? []).map(
          (occurrence) => occurrence.fullText,
        ),
      ]),
      new Set(original.map((occurrence) => occurrence.fullText)),
    );
  });
});
