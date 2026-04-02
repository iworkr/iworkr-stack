// @module eslint.config.mjs
// @status STABLE
// @lastReview 2026-03-28

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/**",
    "flutter/**",
    "electron/**",
    "supabase/functions/**",
    "playwright-report/**",
    "test-results/**",
    "audit-reports/**",
  ]),
  // ── Aegis-Refactor: Strict type safety + hook discipline ──
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Warn on explicit `any` (error once baseline is cleared)
      "@typescript-eslint/no-explicit-any": "warn",
      // Prevent stale closures and infinite re-renders
      "react-hooks/exhaustive-deps": "warn",
      // Next.js 16 / React Compiler rules — too noisy for existing app patterns; re-enable incrementally
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-render": "off",
    },
  },
  // New files created after Aegis-Refactor must be strictly clean
  {
    files: ["src/lib/schemas/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
]);

export default eslintConfig;
