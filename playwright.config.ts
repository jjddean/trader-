import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: path.resolve(__dirname, ".env.local"), quiet: true });

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const isLocalServer = baseURL.startsWith("http://localhost");

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  // One worker: the authenticated journeys share a single Clerk development
  // instance and one Convex deployment, so concurrent files contend over the
  // same sessions and rows. Different specs failed on each parallel run.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Auth journeys sign up real Clerk test users against the dev Convex
  // deployment, so they must never be pointed at a production base URL.
  ...(isLocalServer
    ? {
        webServer: {
          // Production build, not `next dev`. The dev server compiles routes on
          // demand, so the first visit to each page can exceed the test timeout —
          // that produced a different set of failures on every run. `next start`
          // serves everything pre-compiled.
          command: "npm run build && npm run start",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 300_000,
        },
      }
    : {}),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
