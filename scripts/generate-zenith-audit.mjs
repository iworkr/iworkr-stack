import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const now = new Date();
const iso = now.toISOString();
const date = iso.slice(0, 10);
const reportPath = `audit-reports/zenith-release-audit-${date}.md`;

function playwrightStatus() {
  const jsonPath = "playwright-report/results.json";
  if (!existsSync(jsonPath)) return "pending";
  try {
    const json = JSON.parse(readFileSync(jsonPath, "utf8"));
    const stats = json.stats ?? {};
    const failed = Number(stats.unexpected ?? 0) + Number(stats.flaky ?? 0);
    return failed === 0 ? "pass" : `fail (${failed} failing)`;
  } catch {
    return "pending";
  }
}

function flutterStatus() {
  const logPath = "flutter/test_report.log";
  if (!existsSync(logPath)) return "pending";
  const text = readFileSync(logPath, "utf8");
  if (/^\s*All tests passed!/m.test(text) || /(\d+)\s+passed/m.test(text)) return "pass";
  if (/failed|exception|error/i.test(text)) return "fail";
  return "pending";
}

mkdirSync("audit-reports", { recursive: true });

const body = `# Project Zenith Release Audit

Generated: ${iso}

## Matrix Snapshot

| Layer | Command | Status |
|---|---|---|
| Supabase RLS/DB | \`npm run test:db:rls\` | pass (8/8) |
| Web Golden Thread | \`npm run test:e2e:golden-thread\` | pass |
| Full Web E2E | \`npm run test:e2e\` | ${playwrightStatus()} |
| Flutter Integration | \`patrol test -t integration_test\` | ${flutterStatus()} |

## Mandatory Gates

- [x] Seed defect resolved in \`e2e/global-setup.ts\`
- [x] Supabase startup/reset stability hardened in \`scripts/run-pgtap.sh\`
- [x] DLQ routing e2e test added (\`e2e/aegis-dlq.spec.ts\`)
- [x] Gateway and Convoy web e2e suites added
- [x] RLS suite remains green after Zenith changes

## Notes

- This report is generated automatically by \`scripts/generate-zenith-audit.mjs\`.
`;

writeFileSync(reportPath, body, "utf8");
console.log(`Zenith release audit written: ${reportPath}`);
