/**
 * Native Deno tests for the automation-worker edge function.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/automation-worker.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function invoke(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const res = await fetch(`${BASE_URL}/automation-worker`, {
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

Deno.test("automation-worker: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/automation-worker`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("automation-worker: rejects unauthorized (no auth header)", async () => {
  const res = await fetch(`${BASE_URL}/automation-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("automation-worker: dry run rejects invalid flow_id (non-UUID)", async () => {
  const { status, data } = await invoke(
    { flow_id: "not-a-uuid" },
    { "X-Dry-Run": "true" },
  );
  assertEquals(status, 400);
  assertExists(data?.error);
});

Deno.test("automation-worker: dry run rejects missing flow_id", async () => {
  const { status, data } = await invoke(
    {},
    { "X-Dry-Run": "true" },
  );
  assertEquals(status, 400);
  assertExists(data?.error);
});

Deno.test("automation-worker: dry run with nonexistent flow_id returns 404", async () => {
  const { status } = await invoke(
    { flow_id: "00000000-0000-0000-0000-999999999999" },
    { "X-Dry-Run": "true" },
  );
  assertEquals(status, 404);
});

Deno.test("automation-worker: production run with empty body returns success", async () => {
  const { status, data } = await invoke({});
  assertEquals(status, 200);
  assertExists(data?.success);
});
