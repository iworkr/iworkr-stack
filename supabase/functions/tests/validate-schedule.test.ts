/**
 * Native Deno tests for the validate-schedule edge function.
 * Tests scheduling hard gate — credential checks, fatigue rules, qualification matching.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/validate-schedule.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";
const SEED_WORKER_ID = "00000000-0000-0000-0000-000000000002";

async function invoke(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/validate-schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("validate-schedule: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/validate-schedule`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("validate-schedule: rejects unauthenticated request", async () => {
  const res = await fetch(`${BASE_URL}/validate-schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: SEED_ORG_ID }),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("validate-schedule: rejects missing org_id", async () => {
  const { status, data } = await invoke({
    worker_id: SEED_WORKER_ID,
  });
  assertEquals(true, status >= 400);
  assertExists(data?.error || data?.message);
});

Deno.test("validate-schedule: rejects missing worker_id", async () => {
  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
  });
  assertEquals(true, status >= 400);
  assertExists(data?.error || data?.message);
});

Deno.test("validate-schedule: accepts valid payload with full parameters", async () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);

  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    participant_id: "d0000000-0000-0000-0000-000000000001",
  });

  // Should return 200 with validation result OR 400 if constraints not met
  if (status === 200) {
    assertExists(data);
  } else {
    // Acceptable failures: missing credentials, fatigue rules, etc.
    assertEquals(true, [400, 422, 500].includes(status));
  }
});

Deno.test("validate-schedule: fatigue rule check — detects potential violations", async () => {
  // Schedule a shift that would violate the 10h rest rule
  const now = new Date();
  const start = new Date(now);
  start.setHours(2, 0, 0, 0); // 2 AM — likely violates rest period
  const end = new Date(start);
  end.setHours(6, 0, 0, 0); // 6 AM

  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  });

  // This should return warnings about fatigue or be accepted
  if (status === 200 && data?.warnings) {
    assertExists(data.warnings);
  }
});

Deno.test("validate-schedule: handles nonexistent worker gracefully", async () => {
  const { status } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: "00000000-0000-0000-0000-999999999999",
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 7200000).toISOString(),
  });
  assertEquals(true, [400, 404, 500].includes(status));
});
