/**
 * Native Deno tests for the stripe-webhook edge function.
 * Tests HMAC signature validation and event handling.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/stripe-webhook.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";

async function invoke(body: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body,
  });
  return { status: res.status, data: await res.json().catch(() => null), text: await res.text().catch(() => "") };
}

Deno.test("stripe-webhook: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/stripe-webhook`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("stripe-webhook: rejects request without stripe-signature header", async () => {
  const { status } = await invoke(JSON.stringify({
    type: "checkout.session.completed",
    data: { object: {} },
  }));
  // Should reject — no HMAC signature
  assertEquals(true, status >= 400);
});

Deno.test("stripe-webhook: rejects request with invalid signature", async () => {
  const { status } = await invoke(
    JSON.stringify({
      type: "checkout.session.completed",
      data: { object: {} },
    }),
    { "stripe-signature": "t=1234567890,v1=invalid_signature_hash" },
  );
  assertEquals(true, status >= 400);
});

Deno.test("stripe-webhook: rejects empty body", async () => {
  const res = await fetch(`${BASE_URL}/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": "t=1234567890,v1=test",
    },
    body: "",
  });
  assertEquals(true, res.status >= 400);
  await res.text().catch(() => null);
});

Deno.test("stripe-webhook: rejects malformed JSON body", async () => {
  const { status } = await invoke(
    "not valid json {{{",
    { "stripe-signature": "t=1234567890,v1=test" },
  );
  assertEquals(true, status >= 400);
});

Deno.test("stripe-webhook: rejects tampered payload (signature mismatch)", async () => {
  const payload = JSON.stringify({ type: "customer.subscription.updated", data: { object: { id: "sub_test" } } });
  const { status } = await invoke(payload, {
    "stripe-signature": "t=1234567890,v1=0000000000000000000000000000000000000000000000000000000000000000",
  });
  assertEquals(true, status >= 400);
});
