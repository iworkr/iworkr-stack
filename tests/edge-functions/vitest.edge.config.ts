/**
 * @module tests/edge-functions/vitest.edge.config.ts
 * @status STABLE
 * @lastReview 2026-03-28
 */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/edge-functions/**/*.test.ts"],
    globals: true,
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../src"),
    },
  },
});
