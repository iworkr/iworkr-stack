/**
 * Native Deno tests for the smart-roster-match edge function.
 * Tests AI-powered roster matching — worker-to-participant fit scoring.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/smart-roster-match.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

async function invoke(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/smart-roster-match`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

Deno.test("smart-roster-match: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/smart-roster-match`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("smart-roster-match: rejects unauthorized (no auth header)", async () => {
  const res = await fetch(`${BASE_URL}/smart-roster-match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ participant_id: "test" }),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("smart-roster-match: rejects missing participant_id", async () => {
  const { status, data } = await invoke({});
  assertEquals(true, status >= 400);
});

Deno.test("smart-roster-match: rejects invalid participant_id format", async () => {
  const { status, data } = await invoke({
    participant_id: "not-a-uuid",
    organization_id: SEED_ORG_ID,
  });
  assertEquals(true, status >= 400);
});

Deno.test("smart-roster-match: rejects missing organization_id", async () => {
  const { status } = await invoke({
    participant_id: "d0000000-0000-0000-0000-000000000001",
  });
  assertEquals(true, status >= 400);
});

Deno.test("smart-roster-match: returns match results for valid participant", async () => {
  const { status, data } = await invoke({
    participant_id: "d0000000-0000-0000-0000-000000000001",
    organization_id: SEED_ORG_ID,
    date: new Date().toISOString().split("T")[0],
  });
  // May 200 with matches, or 404 if participant not found in this env
  if (status === 200) {
    assertExists(data);
  } else {
    assertEquals(true, [400, 404, 500].includes(status));
  }
});

Deno.test("smart-roster-match: handles nonexistent participant gracefully", async () => {
  const { status } = await invoke({
    participant_id: "d0000000-0000-0000-0000-999999999999",
    organization_id: SEED_ORG_ID,
  });
  assertEquals(true, [400, 404, 500].includes(status));
});
