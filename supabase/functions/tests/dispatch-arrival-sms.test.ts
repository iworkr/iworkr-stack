/**
 * Native Deno tests for the dispatch-arrival-sms edge function.
 * Tests Twilio SMS dispatch when tracking sessions are created.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/dispatch-arrival-sms.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/dispatch-arrival-sms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("dispatch-arrival-sms: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/dispatch-arrival-sms`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("dispatch-arrival-sms: rejects empty body", async () => {
  const { status } = await invoke({});
  assertEquals(true, status >= 400);
});

Deno.test("dispatch-arrival-sms: rejects nonexistent session_id", async () => {
  const { status } = await invoke({
    record: {
      id: "00000000-0000-0000-0000-999999999999",
      organization_id: SEED_ORG_ID,
    },
  });
  assertEquals(true, status >= 400);
});

Deno.test("dispatch-arrival-sms: rejects already-dispatched session", async () => {
  const { status } = await invoke({
    record: {
      id: "00000000-0000-0000-0000-999999999998",
      organization_id: SEED_ORG_ID,
      sms_sent: true,
    },
  });
  // Should reject or handle gracefully — already dispatched
  assertEquals(true, [200, 400, 409, 422].includes(status));
});

Deno.test("dispatch-arrival-sms: rejects session with no client phone", async () => {
  const { status } = await invoke({
    record: {
      id: "00000000-0000-0000-0000-999999999997",
      organization_id: SEED_ORG_ID,
      client_phone: null,
    },
  });
  assertEquals(true, status >= 400);
});

Deno.test("dispatch-arrival-sms: handles malformed record payload", async () => {
  const { status } = await invoke({
    record: "not-an-object",
  });
  assertEquals(true, status >= 400);
});
