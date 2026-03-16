import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Exclude non-web-app directories from linting
    ".claude/**",
    "flutter/**",
    "electron/**",
    "supabase/functions/**",
    "playwright-report/**",
    "test-results/**",
    "audit-reports/**",
  ]),
  // Project Terminus: Strict type safety enforcement
  // New code must not introduce `any` — existing violations tracked via lint baseline.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Warn on new `any` usage — will be enforced as error once baseline is cleared
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
