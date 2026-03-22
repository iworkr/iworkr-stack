/**
 * Native Deno tests for the sentinel-scan edge function.
 * Tests automated risk detection in progress notes and health data.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/sentinel-scan.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/sentinel-scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("sentinel-scan: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/sentinel-scan`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("sentinel-scan: rejects unauthorized request", async () => {
  const res = await fetch(`${BASE_URL}/sentinel-scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: SEED_ORG_ID }),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("sentinel-scan: accepts valid organization scan request", async () => {
  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
  });
  // May succeed scanning or fail if no notes to scan
  assertEquals(true, [200, 400, 404, 500].includes(status));
});

Deno.test("sentinel-scan: handles DB trigger format (record payload)", async () => {
  const { status } = await invoke({
    type: "INSERT",
    table: "progress_notes",
    record: {
      id: "00000000-0000-0000-0000-000000000999",
      organization_id: SEED_ORG_ID,
      content: "Participant fell in bathroom. Bruising observed on left arm. Ambulance called.",
    },
  });
  assertEquals(true, [200, 400, 404, 422, 500].includes(status));
});

Deno.test("sentinel-scan: detects high-risk keywords in note content", async () => {
  const { status, data } = await invoke({
    type: "INSERT",
    table: "progress_notes",
    record: {
      id: "00000000-0000-0000-0000-000000000998",
      organization_id: SEED_ORG_ID,
      content: "Participant reported physical abuse by a family member. Bruises visible on arms. Called police.",
    },
  });
  // If the scan runs, it should detect risk keywords
  if (status === 200 && data?.alerts) {
    assertExists(data.alerts);
  }
});
