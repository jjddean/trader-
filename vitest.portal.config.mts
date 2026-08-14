import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    fileParallelism: false,
    include: ["tests/portal-documents.integration.test.ts"],
  },
});
