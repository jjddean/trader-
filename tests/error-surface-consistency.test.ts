import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Static assertions over the whole error surface.
 *
 * Two codemods rewrote ~58 files mechanically: Convex throws to `userError`, and
 * UI error rendering to `userMessageFromError`. Those files typecheck and lint
 * but carry no behavioural test, and one defect (P1-10) hid there for several
 * runs — a route-authored 502 message was swallowed and replaced with a generic
 * one, telling a broker "could not be updated" when portal access HAD been
 * enabled.
 *
 * These check the pattern everywhere, including files never reviewed by hand.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "_generated") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sourceFiles = [
  ...walk(path.join(ROOT, "src")),
  ...walk(path.join(ROOT, "convex")),
].map((file) => ({ file: path.relative(ROOT, file).replaceAll("\\", "/"), text: fs.readFileSync(file, "utf8") }));

describe("error surface consistency", () => {
  /**
   * The P1-10 class. A locally thrown Error carrying an API route's `error`
   * field must be an ApiError, or userMessageFromError discards the message our
   * own route deliberately wrote.
   */
  it("API-sourced throws use ApiError, not Error", () => {
    const offenders: string[] = [];
    const pattern = /throw new Error\(\s*(?:body|data|json|payload|result|res)\??\.\w+\s*\|\|/g;

    for (const { file, text } of sourceFiles) {
      if (!/userMessageFromError/.test(text)) continue;
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split("\n").length;
        offenders.push(`${file}:${line}`);
      }
    }
    assert.deepEqual(offenders, [], `plain Error carrying an API message:\n${offenders.join("\n")}`);
  });

  /**
   * A raw err.message rendered to the user re-opens the leak the sweep closed.
   * Server routes under src/app/api are excluded: they parse `.message` for the
   * HMRC sentinel prefixes (SUBMIT_BLOCKED, ENVIRONMENT_MISMATCH) and their
   * output is a JSON field, not something rendered to a customer.
   */
  it("no rendered component surfaces a raw error message", () => {
    const offenders: string[] = [];
    const pattern = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message/g;

    for (const { file, text } of sourceFiles) {
      if (!file.startsWith("src/")) continue;
      if (file.startsWith("src/app/api/") || file.startsWith("src/lib/")) continue;
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split("\n").length;
        offenders.push(`${file}:${line}`);
      }
    }
    assert.deepEqual(offenders, [], `raw err.message reaches the user:\n${offenders.join("\n")}`);
  });

  /** userError messages are shown verbatim, so they must not leak internals. */
  it("userError messages carry no internal detail", () => {
    const offenders: string[] = [];
    const pattern = /userError\(\s*"[^"]+"\s*,\s*(?:"([^"]*)"|`([^`]*)`)/g;
    const leaks = [
      /\bctx\.db\b/,
      /\bconvex\b/i,
      /\bstack\b/i,
      /_id\b/,
      /process\.env/,
      /\bundefined\b/,
    ];

    for (const { file, text } of sourceFiles) {
      for (const match of text.matchAll(pattern)) {
        const message = match[1] ?? match[2] ?? "";
        if (leaks.some((leak) => leak.test(message))) {
          const line = text.slice(0, match.index).split("\n").length;
          offenders.push(`${file}:${line} — ${message}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `internal detail in a customer-facing message:\n${offenders.join("\n")}`);
  });

  /** Auth failures must be indistinguishable, or they confirm a record exists. */
  it("forbidden errors never say why", () => {
    const offenders: string[] = [];
    const pattern = /userError\(\s*"(forbidden|unauthorized)"\s*,\s*"([^"]*)"/gi;

    for (const { file, text } of sourceFiles) {
      for (const match of text.matchAll(pattern)) {
        if (/\b(owner|belongs|org|organisation|client|declaration)\b/i.test(match[2])) {
          const line = text.slice(0, match.index).split("\n").length;
          offenders.push(`${file}:${line} — ${match[2]}`);
        }
      }
    }
    assert.deepEqual(offenders, [], `forbidden message leaks context:\n${offenders.join("\n")}`);
  });

  /** Every mutation reachable by a customer should fail readably, not opaquely. */
  it("the remaining plain throws in convex are a known, shrinking set", () => {
    let count = 0;
    for (const { file, text } of sourceFiles) {
      if (!file.startsWith("convex/")) continue;
      count += (text.match(/throw new Error\(/g) ?? []).length;
    }
    // Was 330 before the migration. The remainder are internal invariants and
    // the HMRC sentinel throws the API routes parse. Lower this as they go.
    assert.ok(count <= 47, `expected <= 47 plain throws in convex/, found ${count}`);
  });
});
