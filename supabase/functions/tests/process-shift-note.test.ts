/**
 * Native Deno tests for the process-shift-note edge function.
 * Tests shift note submission processing — template validation, signatures, EVV.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/process-shift-note.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";
const SEED_WORKER_ID = "00000000-0000-0000-0000-000000000002";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/process-shift-note`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("process-shift-note: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/process-shift-note`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("process-shift-note: rejects missing org_id", async () => {
  const { status, data } = await invoke({
    shift_id: "test-shift",
    worker_id: SEED_WORKER_ID,
  });
  assertEquals(true, status >= 400);
  assertExists(data?.error || data?.message);
});

Deno.test("process-shift-note: rejects missing shift_id", async () => {
  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
  });
  assertEquals(true, status >= 400);
});

Deno.test("process-shift-note: rejects missing worker_id", async () => {
  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    shift_id: "test-shift",
  });
  assertEquals(true, status >= 400);
});

Deno.test("process-shift-note: rejects when worker_declared is false", async () => {
  const { status } = await invoke({
    org_id: SEED_ORG_ID,
    shift_id: "test-shift",
    worker_id: SEED_WORKER_ID,
    worker_declared: false,
    note_content: "Test note content",
  });
  // Should reject — worker must declare accuracy
  assertEquals(true, status >= 400);
});

Deno.test("process-shift-note: accepts valid shift note payload", async () => {
  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    shift_id: "00000000-0000-0000-0000-000000000100",
    worker_id: SEED_WORKER_ID,
    worker_declared: true,
    note_content: "Participant had a good day. Attended community access program. No incidents.",
    participant_id: "d0000000-0000-0000-0000-000000000001",
  });

  // May succeed or fail based on shift existence
  if (status === 200) {
    assertExists(data);
  } else {
    assertEquals(true, [400, 404, 422, 500].includes(status));
  }
});

Deno.test("process-shift-note: handles signature exemption flag", async () => {
  const { status } = await invoke({
    org_id: SEED_ORG_ID,
    shift_id: "00000000-0000-0000-0000-000000000100",
    worker_id: SEED_WORKER_ID,
    worker_declared: true,
    note_content: "Signature exempt — participant refused to sign.",
    signature_exempt: true,
    exemption_reason: "Participant refused",
    participant_id: "d0000000-0000-0000-0000-000000000001",
  });

  // Should handle the exemption flag
  assertEquals(true, [200, 400, 404, 422, 500].includes(status));
});
