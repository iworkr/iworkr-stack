/**
 * Project Terminus — DLQ Enforcement Integration Test
 * ═══════════════════════════════════════════════════════════════════════════════
 * Verifies that malformed webhook payloads are correctly routed to the
 * webhook_dead_letters table instead of being silently dropped.
 *
 * This test sends a deliberately malformed payload (missing tenant_id) to the
 * webhooks-ingest Edge Function and asserts the DLQ table increments by 1 row.
 */

import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

test.describe("Project Terminus: DLQ Enforcement", () => {
  test("malformed webhook payload routes to webhook_dead_letters", async ({
    request,
  }) => {
    // Skip if no service key available (local dev without Supabase running)
    test.skip(!SUPABASE_SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY not configured");

    // 1. Count existing DLQ rows
    const beforeRes = await request.get(
      `${SUPABASE_URL}/rest/v1/webhook_dead_letters?select=id&order=created_at.desc&limit=100`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "count=exact",
        },
      },
    );
    const beforeCount = parseInt(
      beforeRes.headers()["content-range"]?.split("/")?.[1] || "0",
      10,
    );

    // 2. Send a deliberately malformed webhook payload
    // Missing required `tenant_id` — this should trigger DLQ routing
    const malformedPayload = {
      event_type: "terminus.dlq.test",
      // Intentionally omitted: tenant_id
      data: {
        test_id: `terminus-dlq-test-${Date.now()}`,
        purpose: "Automated DLQ enforcement test from Project Terminus",
      },
    };

    const ingestRes = await request.post(
      `${SUPABASE_URL}/functions/v1/webhooks-ingest`,
      {
        data: malformedPayload,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    );

    // The function should return 200 (accepted into DLQ) or 422 (validation error)
    // Either way, the payload must NOT be silently dropped
    expect([200, 202, 422, 400].includes(ingestRes.status())).toBeTruthy();

    // 3. Wait a moment for async DLQ insert
    await new Promise((r) => setTimeout(r, 2000));

    // 4. Count DLQ rows again
    const afterRes = await request.get(
      `${SUPABASE_URL}/rest/v1/webhook_dead_letters?select=id&order=created_at.desc&limit=100`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "count=exact",
        },
      },
    );
    const afterCount = parseInt(
      afterRes.headers()["content-range"]?.split("/")?.[1] || "0",
      10,
    );

    // 5. Assert: DLQ table should have grown by at least 1 row
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
  });

  test("DLQ entries contain correct metadata fields", async ({ request }) => {
    test.skip(!SUPABASE_SERVICE_KEY, "SUPABASE_SERVICE_ROLE_KEY not configured");

    // Fetch the most recent DLQ entry
    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/webhook_dead_letters?select=*&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const rows = await res.json();
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const entry = rows[0];
    // Every DLQ entry must have these minimum fields
    expect(entry).toHaveProperty("id");
    expect(entry).toHaveProperty("created_at");
    expect(entry).toHaveProperty("payload");
  });
});
