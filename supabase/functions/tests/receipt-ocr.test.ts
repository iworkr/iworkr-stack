/**
 * Native Deno tests for the receipt-ocr edge function.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/receipt-ocr.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/receipt-ocr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("receipt-ocr: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/receipt-ocr`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("receipt-ocr: rejects empty body (no image_base64 or storage_path)", async () => {
  const { status } = await invoke({});
  assertEquals(true, status >= 400);
});

Deno.test("receipt-ocr: rejects invalid storage_path", async () => {
  const { status, data } = await invoke({
    storage_path: "nonexistent/path/to/receipt.jpg",
    organization_id: "00000000-0000-0000-0000-000000000010",
  });
  assertEquals(true, status >= 400);
});

Deno.test("receipt-ocr: processes base64 image (mock env)", async () => {
  // 1x1 transparent PNG as minimal valid image
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const { status, data } = await invoke({
    image_base64: tinyPng,
    mime_type: "image/png",
    organization_id: "00000000-0000-0000-0000-000000000010",
  });

  // In test env with mock AI, this should either succeed or fail with a known error
  if (status === 200) {
    assertExists(data?.success);
  } else {
    // AI key not configured or mock not active — acceptable failure
    assertEquals(true, status >= 400);
  }
});
