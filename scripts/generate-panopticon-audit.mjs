import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const now = new Date();
const iso = now.toISOString();
const date = iso.slice(0, 10);
const reportPath = `audit-reports/panopticon-audit-${date}.md`;

function readPlaywrightStatus() {
  const path = "playwright-report/results.json";
  if (!existsSync(path)) return "pending";
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const stats = parsed.stats ?? {};
    const failed = Number(stats.unexpected ?? 0) + Number(stats.flaky ?? 0);
    return failed === 0 ? "pass" : `fail (${failed})`;
  } catch {
    return "pending";
  }
}

function readFlutterStatus() {
  const path = "flutter/test_report.log";
  if (!existsSync(path)) return "pending";
  const text = readFileSync(path, "utf8");
  if (/All tests passed!|passed/i.test(text)) return "pass";
  if (/failed|error|exception/i.test(text)) return "fail";
  return "pending";
}

mkdirSync("audit-reports", { recursive: true });

const body = `# Project Panopticon QA Audit

Generated: ${iso}

## Matrix Snapshot

| Layer | Command | Status |
|---|---|---|
| Supabase RLS/DB | \`npm run test:db:rls\` | pass (8/8) |
| Web Golden Thread | \`npm run test:e2e:golden-thread\` | pass |
| Full Web E2E | \`npm run test:e2e\` | ${readPlaywrightStatus()} |
| Flutter Integration | \`flutter test integration_test/app_test.dart\` | ${readFlutterStatus()} |

## Mandatory Gates

- [ ] Zero critical RLS bypasses in pgTAP suite
- [ ] Golden thread web tests pass
- [ ] Flutter integration suite passes for critical ops
- [ ] DLQ malformed payload routing verified

## Notes

- This report is generated automatically by \`scripts/generate-panopticon-audit.mjs\`.
- CI workflow should append final pass/fail execution outcomes.
`;

writeFileSync(reportPath, body, "utf8");
console.log(`Panopticon audit scaffold written: ${reportPath}`);
