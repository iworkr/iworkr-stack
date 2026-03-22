/**
 * Native Deno tests for the polar-webhook edge function.
 * Tests Polar.sh subscription webhook handling.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/polar-webhook.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";

async function invoke(body: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/polar-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("polar-webhook: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/polar-webhook`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("polar-webhook: rejects request without webhook signature", async () => {
  const { status } = await invoke(JSON.stringify({
    type: "subscription.created",
    data: {},
  }));
  assertEquals(true, status >= 400);
});

Deno.test("polar-webhook: rejects invalid HMAC signature", async () => {
  const { status } = await invoke(
    JSON.stringify({
      type: "subscription.created",
      data: { id: "sub_test" },
    }),
    { "webhook-id": "msg_test", "webhook-timestamp": "1234567890", "webhook-signature": "v1,invalid_sig" },
  );
  assertEquals(true, status >= 400);
});

Deno.test("polar-webhook: rejects empty body", async () => {
  const res = await fetch(`${BASE_URL}/polar-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "",
  });
  assertEquals(true, res.status >= 400);
  await res.text().catch(() => null);
});

Deno.test("polar-webhook: rejects malformed JSON", async () => {
  const { status } = await invoke("{{not json}}");
  assertEquals(true, status >= 400);
});
