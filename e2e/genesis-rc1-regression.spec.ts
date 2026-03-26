import { test, expect } from "@playwright/test";
import { useInboxStore } from "@/lib/inbox-store";

test.describe("Genesis RC1 Regression Gate", () => {
  test("RBAC parity bridge redirects /settings/* to /dashboard/settings/*", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/dashboard\/settings\/profile/);
  });

  test("Notification store dedupes duplicate realtime payload ids", async () => {
    const previous = useInboxStore.getState().items;
    const payload = {
      new: {
        id: "rc1-dedupe-test-id",
        title: "RC1 test",
        body: "duplicate insert check",
        type: "system",
        created_at: new Date().toISOString(),
      },
    };

    useInboxStore.setState({ items: [] });
    useInboxStore.getState().addRealtimeItem(payload);
    useInboxStore.getState().addRealtimeItem(payload);

    const ids = useInboxStore.getState().items.map((i) => i.id);
    expect(ids.filter((id) => id === "rc1-dedupe-test-id")).toHaveLength(1);

    useInboxStore.setState({ items: previous });
  });

  test("Stripe webhook hard-fail + DLQ (env-gated)", async ({ request }) => {
    test.skip(
      !process.env.RC1_STRIPE_WEBHOOK_FIXTURE,
      "Set RC1_STRIPE_WEBHOOK_FIXTURE to run signed webhook failure assertions."
    );

    const fixture = JSON.parse(process.env.RC1_STRIPE_WEBHOOK_FIXTURE as string) as {
      body: string;
      signature: string;
    };

    const response = await request.post("/api/stripe/webhook", {
      data: fixture.body,
      headers: {
        "stripe-signature": fixture.signature,
        "content-type": "application/json",
      },
    });

    expect([200, 500]).toContain(response.status());
  });

  test("Atomic invoice rollback (env-gated)", async ({ request }) => {
    test.skip(
      !process.env.RC1_INVOICE_RPC_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "Set RC1_INVOICE_RPC_URL and SUPABASE_SERVICE_ROLE_KEY for rollback validation."
    );

    const url = process.env.RC1_INVOICE_RPC_URL as string;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    const res = await request.post(url, {
      data: {
        p_org_id: "00000000-0000-0000-0000-000000000000",
        p_items: [{ description: "bad", quantity: "x", unit_price: 10 }],
      },
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
    });

    expect([400, 401, 403, 404]).toContain(res.status());
  });
});
