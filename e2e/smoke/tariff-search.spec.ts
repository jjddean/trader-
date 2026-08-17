import { expect, test } from "@playwright/test";

/**
 * The commodity-code lookup moved out of an unauthenticated Convex action into a
 * rate-limited API route. Public by design — /hs-code-lookup is a marketing page.
 */
test.describe("tariff search", () => {
  test("returns a commodity code for a real term", async ({ request }) => {
    const response = await request.post("/api/tariff/search", {
      data: { query: "laptop" },
    });
    expect(response.ok()).toBeTruthy();

    const body = (await response.json()) as {
      results: Array<{ code: string; description: string }>;
    };
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].code).toMatch(/^\d{4,10}$/);
    expect(body.results[0].description.length).toBeGreaterThan(0);
  });

  test("returns nothing for nonsense rather than erroring", async ({ request }) => {
    const response = await request.post("/api/tariff/search", {
      data: { query: "zzzznotarealcommodity" },
    });
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).results).toEqual([]);
  });

  test("rejects an over-long search term", async ({ request }) => {
    const response = await request.post("/api/tariff/search", {
      data: { query: "x".repeat(201) },
    });
    expect(response.status()).toBe(400);
  });

  test("rate limits a burst from one caller", async ({ request }) => {
    const limit = 30;
    const statuses: number[] = [];
    for (let i = 0; i < limit + 5; i++) {
      const response = await request.post("/api/tariff/search", {
        data: { query: "" }, // empty short-circuits before the upstream call
      });
      statuses.push(response.status());
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
