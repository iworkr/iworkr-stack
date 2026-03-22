import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import { faker } from "@faker-js/faker";
import { getCrucibleTarget } from "./crucible_registry.mjs";

const PROJECT_ROOT = process.cwd();
const FUNCTIONS_DIR = join(PROJECT_ROOT, "supabase/functions");
const OUT_JSON = join(PROJECT_ROOT, "audit-reports/edge-crucible-ledger.json");
const OUT_MD = join(PROJECT_ROOT, "audit-reports/edge-crucible-ledger.md");

const BASE_URL = process.env.SUPABASE_FUNCTIONS_URL ?? "http://127.0.0.1:54321/functions/v1";
const DB_URL = process.env.DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function withTimeout(promise, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), ms);
  return { controller, timer, promise };
}

function assertLocalOnly() {
  const baseIsLocal = /127\.0\.0\.1|localhost/.test(BASE_URL);
  const dbIsLocal = /127\.0\.0\.1|localhost/.test(DB_URL);
  if (!baseIsLocal || !dbIsLocal) {
    throw new Error("FATAL: Crucible must run against local Supabase only (127.0.0.1/localhost).");
  }
}

async function listFunctions() {
  const entries = await readdir(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== "_shared")
    .map((e) => e.name)
    .sort();
}

async function getTableStats(client) {
  const { rows } = await client.query(
    `select relname as table_name, n_tup_ins, n_tup_upd, n_tup_del
     from pg_stat_user_tables
     where schemaname = 'public'`
  );
  const map = new Map();
  for (const row of rows) {
    map.set(row.table_name, {
      ins: Number(row.n_tup_ins || 0),
      upd: Number(row.n_tup_upd || 0),
      del: Number(row.n_tup_del || 0),
    });
  }
  return map;
}

function diffStats(before, after) {
  const out = [];
  const names = new Set([...before.keys(), ...after.keys()]);
  for (const name of names) {
    const b = before.get(name) || { ins: 0, upd: 0, del: 0 };
    const a = after.get(name) || { ins: 0, upd: 0, del: 0 };
    const di = a.ins - b.ins;
    const du = a.upd - b.upd;
    const dd = a.del - b.del;
    if (di !== 0 || du !== 0 || dd !== 0) {
      out.push({ table: name, ins: di, upd: du, del: dd });
    }
  }
  return out.sort((x, y) => x.table.localeCompare(y.table));
}

function classifyScenario(scenarioId, status, timedOut) {
  if (scenarioId === "skipped") return "SKIPPED";
  if (timedOut) return "FAIL_TIMEOUT";
  if (scenarioId === "unauthorized") {
    return status >= 200 && status < 300 ? "FAIL_UNAUTHORIZED_ACCEPTED" : "PASS";
  }
  if (scenarioId === "malformed") {
    if (status >= 400 && status < 500) return "PASS";
    if (status >= 500) return "FAIL_500_ON_MALFORMED";
    return "WARN_ACCEPTED_MALFORMED";
  }
  if (scenarioId === "happy") {
    if (status >= 200 && status < 300) return "PASS";
    if (status >= 500) return "FAIL_500_ON_HAPPY";
    return "WARN_NON_2XX_HAPPY";
  }
  return "UNKNOWN";
}

function summarizeFunction(results) {
  const marks = results
    .filter((r) => r.classification !== "SKIPPED")
    .map((r) => r.classification);
  if (marks.length === 0) return "PASS";
  if (marks.some((m) => m.startsWith("FAIL"))) return "FAIL";
  if (marks.some((m) => m.startsWith("WARN"))) return "WARN";
  return "PASS";
}

async function firstValue(client, query, params = []) {
  const { rows } = await client.query(query, params);
  if (!rows.length) return null;
  return Object.values(rows[0])[0] ?? null;
}

async function buildSeedContext(client) {
  const workspace_id = await firstValue(
    client,
    "select id from public.organizations order by created_at asc limit 1"
  );
  if (!workspace_id) {
    throw new Error("FATAL: No organizations found. Run local seed first.");
  }

  const admin_user_id =
    (await firstValue(
      client,
      "select user_id from public.organization_members where organization_id=$1 and role in ('owner','admin') order by user_id asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(
      client,
      "select user_id from public.organization_members where organization_id=$1 order by user_id asc limit 1",
      [workspace_id]
    ));

  const worker_user_id =
    (await firstValue(
      client,
      "select user_id from public.organization_members where organization_id=$1 and user_id <> $2 order by user_id asc limit 1",
      [workspace_id, admin_user_id]
    )) || admin_user_id;

  const client_id =
    (await firstValue(
      client,
      "select id from public.clients where organization_id=$1 order by id asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(client, "select id from public.clients order by id asc limit 1"));

  const participant_id =
    (await firstValue(
      client,
      "select id from public.participant_profiles where organization_id=$1 order by id asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(
      client,
      "select id from public.participant_profiles order by id asc limit 1"
    ));

  const job_id =
    (await firstValue(
      client,
      "select id from public.jobs where organization_id=$1 and deleted_at is null order by id asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(
      client,
      "select id from public.jobs where deleted_at is null order by id asc limit 1"
    ));

  const invoice_id =
    (await firstValue(
      client,
      "select id from public.invoices where organization_id=$1 and deleted_at is null order by id asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(
      client,
      "select id from public.invoices where deleted_at is null order by id asc limit 1"
    ));

  const shift_id =
    (await firstValue(
      client,
      "select id from public.schedule_blocks where organization_id=$1 order by start_time asc limit 1",
      [workspace_id]
    )) ||
    (await firstValue(
      client,
      "select id from public.schedule_blocks order by start_time asc limit 1"
    ));

  let care_blueprint_id = null;
  try {
    care_blueprint_id = await firstValue(
      client,
      "select id from public.care_plan_blueprints where organization_id=$1 order by id asc limit 1",
      [workspace_id]
    );
  } catch {
    care_blueprint_id = null;
  }

  return {
    workspace_id,
    admin_user_id,
    worker_user_id,
    client_id,
    participant_id,
    job_id,
    invoice_id: invoice_id || faker.string.uuid(),
    care_blueprint_id: care_blueprint_id || job_id || faker.string.uuid(),
    shift_id: shift_id || job_id || faker.string.uuid(),
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeMalformedPayload(happyPayload) {
  const bad = deepClone(happyPayload ?? {});
  if (!bad || typeof bad !== "object" || Array.isArray(bad)) {
    return { malformed: true };
  }

  const keys = Object.keys(bad);
  const uuidKey = keys.find((k) => k === "id" || k.endsWith("_id") || k.includes("Id"));

  if (uuidKey) {
    bad[uuidKey] = "not-a-uuid";
    return bad;
  }

  if (keys.length > 0) {
    delete bad[keys[0]];
    return bad;
  }

  return { ...bad, malformed: true, payload: null };
}

async function invokeFunction(url, payload, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) headers.Authorization = `Bearer ${SERVICE_ROLE_KEY}`;

  let status = null;
  let body = "";
  let timedOut = false;
  const started = Date.now();
  try {
    const { controller, timer } = withTimeout(Promise.resolve(), 12000);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    status = res.status;
    body = (await res.text()).slice(0, 500);
  } catch (err) {
    timedOut = String(err).includes("timeout") || String(err).includes("AbortError");
    body = String(err).slice(0, 500);
  }
  return { status, body, timedOut, elapsedMs: Date.now() - started };
}

async function main() {
  assertLocalOnly();
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  const seeds = await buildSeedContext(client);
  console.log("🌱 SeedContext:", JSON.stringify(seeds, null, 2));
  const functions = await listFunctions();
  const ledger = [];

  for (const fn of functions) {
    const target = getCrucibleTarget(fn);
    const happyPayload = target.generateHappy(seeds, faker);
    const malformedPayload = makeMalformedPayload(happyPayload);

    const scenarios = [
      { id: "happy", auth: true, body: happyPayload },
      { id: "malformed", auth: true, body: malformedPayload },
    ];
    if (!target.isPublicWebhook) {
      scenarios.push({ id: "unauthorized", auth: false, body: happyPayload });
    } else {
      scenarios.push({ id: "skipped", auth: false, body: happyPayload });
    }

    const fnResults = [];
    for (const scenario of scenarios) {
      if (scenario.id === "skipped") {
        fnResults.push({
          scenario: "unauthorized",
          status: null,
          timedOut: false,
          elapsedMs: 0,
          classification: "SKIPPED",
          responseSnippet: "Skipped: public webhook endpoint",
          mutationDelta: [],
        });
        continue;
      }
      const before = await getTableStats(client);
      const url = `${BASE_URL}/${fn}`;
      const { status, body, timedOut, elapsedMs } = await invokeFunction(url, scenario.body, scenario.auth);
      const after = await getTableStats(client);
      const mutationDelta = diffStats(before, after);
      const classification = classifyScenario(scenario.id, status ?? 0, timedOut);

      fnResults.push({
        scenario: scenario.id,
        status,
        timedOut,
        elapsedMs,
        classification,
        responseSnippet: body,
        mutationDelta,
      });
    }
    ledger.push({
      function: fn,
      verdict: summarizeFunction(fnResults),
      scenarios: fnResults,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    seedContext: seeds,
    functionsTotal: ledger.length,
    verdictCounts: {
      PASS: ledger.filter((l) => l.verdict === "PASS").length,
      WARN: ledger.filter((l) => l.verdict === "WARN").length,
      FAIL: ledger.filter((l) => l.verdict === "FAIL").length,
    },
  };

  await writeFile(OUT_JSON, JSON.stringify({ summary, ledger }, null, 2), "utf8");

  const md = [
    "# Edge Crucible Ledger",
    "",
    `Generated: ${summary.generatedAt}`,
    "## Seed Context",
    "",
    `- workspace_id: ${seeds.workspace_id}`,
    `- admin_user_id: ${seeds.admin_user_id}`,
    `- worker_user_id: ${seeds.worker_user_id}`,
    `- client_id: ${seeds.client_id}`,
    `- participant_id: ${seeds.participant_id}`,
    `- job_id: ${seeds.job_id}`,
    "",
    `Functions: ${summary.functionsTotal}`,
    `PASS: ${summary.verdictCounts.PASS} | WARN: ${summary.verdictCounts.WARN} | FAIL: ${summary.verdictCounts.FAIL}`,
    "",
    "## Per-function verdict",
    "",
    ...ledger.map((l) => {
      const lines = [`### ${l.function} — ${l.verdict}`];
      for (const s of l.scenarios) {
        lines.push(`- ${s.scenario}: status=${s.status ?? "n/a"} timeout=${s.timedOut} class=${s.classification} mutations=${s.mutationDelta.length}`);
      }
      return lines.join("\n");
    }),
    "",
  ].join("\n");
  await writeFile(OUT_MD, md, "utf8");

  await client.end();
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
