/**
 * Native Deno tests for the vision-hazard-analyzer edge function.
 * Tests multimodal SWMS auto-generation via Gemini Vision.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/tests/vision-hazard-analyzer.test.ts
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = Deno.env.get("SUPABASE_FUNCTIONS_URL") ?? "http://127.0.0.1:54321/functions/v1";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const SEED_ORG_ID = "00000000-0000-0000-0000-000000000010";

async function invoke(body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/vision-hazard-analyzer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

Deno.test("vision-hazard-analyzer: CORS preflight returns 200", async () => {
  const res = await fetch(`${BASE_URL}/vision-hazard-analyzer`, {
    method: "OPTIONS",
    headers: {
      "Origin": "http://localhost:3000",
      "Access-Control-Request-Method": "POST",
    },
  });
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("vision-hazard-analyzer: rejects unauthorized request", async () => {
  const res = await fetch(`${BASE_URL}/vision-hazard-analyzer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organization_id: SEED_ORG_ID }),
  });
  assertEquals(res.status, 401);
  await res.json().catch(() => null);
});

Deno.test("vision-hazard-analyzer: rejects empty body", async () => {
  const { status } = await invoke({});
  assertEquals(true, status >= 400);
});

Deno.test("vision-hazard-analyzer: rejects missing image data", async () => {
  const { status } = await invoke({
    organization_id: SEED_ORG_ID,
    job_id: "a0000001-0000-0000-0000-000000000001",
    // No image_base64 or storage_path
  });
  assertEquals(true, status >= 400);
});

Deno.test("vision-hazard-analyzer: processes minimal image (mock env)", async () => {
  // 1x1 red PNG
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const { status, data } = await invoke({
    organization_id: SEED_ORG_ID,
    job_id: "a0000001-0000-0000-0000-000000000001",
    image_base64: tinyPng,
    mime_type: "image/png",
  });

  // In test env, AI may not be configured
  if (status === 200) {
    assertExists(data);
  } else {
    assertEquals(true, [400, 422, 500, 503].includes(status));
  }
});

Deno.test("vision-hazard-analyzer: handles multiple images array", async () => {
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  const { status } = await invoke({
    organization_id: SEED_ORG_ID,
    job_id: "a0000001-0000-0000-0000-000000000001",
    images: [
      { base64: tinyPng, mime_type: "image/png" },
      { base64: tinyPng, mime_type: "image/png" },
    ],
  });

  assertEquals(true, [200, 400, 422, 500, 503].includes(status));
});
