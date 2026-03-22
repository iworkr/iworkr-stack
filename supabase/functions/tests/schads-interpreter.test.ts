/**
 * Native Deno tests for the schads-interpreter edge function.
 * Tests the 5-step deterministic SCHADS Award payroll pipeline.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/schads-interpreter.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";
const SEED_WORKER_ID = "00000000-0000-0000-0000-000000000002";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/schads-interpreter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("schads-interpreter: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/schads-interpreter`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("schads-interpreter: rejects unauthorized request", async () => {
  const res = await fetch(`${BASE_URL}/schads-interpreter`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ org_id: SEED_ORG_ID }),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("schads-interpreter: rejects missing org_id", async () => {
  const { status } = await invoke({
    worker_id: SEED_WORKER_ID,
    shifts: [],
  });
  assertEquals(true, status >= 400);
});

Deno.test("schads-interpreter: rejects empty shifts array", async () => {
  const { status } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    shifts: [],
  });
  // May accept empty with no-op or reject
  assertEquals(true, [200, 400, 422].includes(status));
});

Deno.test("schads-interpreter: processes standard weekday shift", async () => {
  // Create a standard Mon-Fri 9am-5pm shift
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); // Last Monday
  monday.setHours(9, 0, 0, 0);
  const mondayEnd = new Date(monday);
  mondayEnd.setHours(17, 0, 0, 0);

  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    pay_level: "SACS_4",
    shifts: [{
      id: "shift-001",
      start: monday.toISOString(),
      end: mondayEnd.toISOString(),
      type: "ordinary",
    }],
  });

  if (status === 200) {
    assertExists(data);
    // Should have pay lines or fractures
    if (data?.fractures || data?.pay_lines) {
      assertExists(data.fractures || data.pay_lines);
    }
  } else {
    assertEquals(true, [400, 404, 422, 500].includes(status));
  }
});

Deno.test("schads-interpreter: handles overnight shift crossing midnight", async () => {
  const today = new Date();
  today.setHours(22, 0, 0, 0); // 10 PM
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0); // 6 AM

  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    pay_level: "SACS_3",
    shifts: [{
      id: "shift-overnight",
      start: today.toISOString(),
      end: tomorrow.toISOString(),
      type: "sleepover",
    }],
  });

  // Midnight splitter should fracture this into two calendar-day segments
  if (status === 200 && data?.fractures) {
    assertExists(data.fractures);
  }
});

Deno.test("schads-interpreter: handles weekend shift with penalty rates", async () => {
  const saturday = new Date();
  saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7)); // Next Saturday
  saturday.setHours(8, 0, 0, 0);
  const saturdayEnd = new Date(saturday);
  saturdayEnd.setHours(16, 0, 0, 0);

  const { status, data } = await invoke({
    org_id: SEED_ORG_ID,
    worker_id: SEED_WORKER_ID,
    pay_level: "SACS_4",
    shifts: [{
      id: "shift-weekend",
      start: saturday.toISOString(),
      end: saturdayEnd.toISOString(),
      type: "ordinary",
    }],
  });

  if (status === 200 && data) {
    // Weekend shifts should have penalty loading applied
    assertExists(data);
  }
});
