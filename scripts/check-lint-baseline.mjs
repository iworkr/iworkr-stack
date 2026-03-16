import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const baselinePath = resolve(root, "config/lint-baseline.json");
const outputPath = resolve(root, "config/lint-current.json");

const run = spawnSync("npx", ["eslint", ".", "--format", "json", "--output-file", outputPath], {
  cwd: root,
  encoding: "utf8",
});

if (run.status !== 0 && run.status !== 1) {
  process.stderr.write(run.stderr || run.stdout);
  process.exit(run.status ?? 1);
}

const report = JSON.parse(readFileSync(outputPath, "utf8"));
let errors = 0;
let warnings = 0;
for (const file of report) {
  errors += Number(file.errorCount || 0);
  warnings += Number(file.warningCount || 0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const maxErrors = Number(baseline.maxErrors || 0);
const maxWarnings = Number(baseline.maxWarnings || 0);

writeFileSync(
  outputPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      errors,
      warnings,
      baseline,
    },
    null,
    2,
  ),
);

if (errors > maxErrors || warnings > maxWarnings) {
  console.error(
    `Lint baseline exceeded: errors ${errors}/${maxErrors}, warnings ${warnings}/${maxWarnings}`,
  );
  process.exit(1);
}

console.log(`Lint baseline OK: errors ${errors}/${maxErrors}, warnings ${warnings}/${maxWarnings}`);
