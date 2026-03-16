import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.describe("Project Aegis-Core - DLQ Routing", () => {
  test("unresolved tenant webhook routes to webhook_dead_letters", async ({ request }) => {
    test.skip(!SUPABASE_URL || !SUPABASE_SERVICE_KEY, "Supabase env vars are required");

    const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const marker = `E2E_UNRESOLVED_${Date.now()}`;
    const payload = {
      events: [{ eventType: marker, resourceType: "Invoice", eventDateUtc: new Date().toISOString() }],
    };

    const fnUrl = `${SUPABASE_URL}/functions/v1/webhooks-ingest`;
    const res = await request.post(fnUrl, {
      data: payload,
      headers: {
        "content-type": "application/json",
        "x-xero-tenant-id": `fake-tenant-${Date.now()}`,
        authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });

    expect(res.status()).toBe(200);

    // Poll briefly for ingestion write.
    let found = false;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await admin
        .from("webhook_dead_letters")
        .select("id, source, failure_reason, raw_payload")
        .eq("source", "xero")
        .contains("raw_payload", { events: [{ eventType: marker }] })
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        found = true;
        expect(String(data[0].failure_reason)).toContain("UNRESOLVED_INTEGRATION_ID");
        await admin.from("webhook_dead_letters").delete().eq("id", data[0].id);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    expect(found).toBeTruthy();
  });
});
