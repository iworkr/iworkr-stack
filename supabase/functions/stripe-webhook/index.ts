import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_MAP: Record<string, string> = {
  price_starter_monthly: "starter",
  price_starter_yearly: "starter",
  price_pro_monthly: "pro",
  price_pro_yearly: "pro",
  price_business_monthly: "business",
  price_business_yearly: "business",
};

function getPlanFromPriceId(priceId: string): string {
  return PLAN_MAP[priceId] ?? "free";
}

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string
): Promise<Record<string, unknown>> {
  const encoder = new TextEncoder();
  const parts = signature.split(",").reduce(
    (acc, part) => {
      const [key, value] = part.split("=");
      if (key === "t") acc.timestamp = value;
      if (key === "v1") acc.signatures.push(value);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] }
  );

  const payload = `${parts.timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const expectedSig = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!parts.signatures.includes(expectedSig)) {
    throw new Error("Invalid Stripe signature");
  }

  return JSON.parse(body);
}

// TODO: Replace with indexed lookup: SELECT org_id FROM org_settings WHERE stripe_customer_id = $1
async function findOrgByStripeCustomer(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
): Promise<{ id: string; settings: Record<string, unknown> } | null> {
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, settings");

  if (!orgs) return null;

  for (const org of orgs) {
    const settings = (org.settings as Record<string, unknown>) ?? {};
    if (settings.stripe_customer_id === customerId) {
      return { id: org.id, settings };
    }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Record<string, unknown>;

  try {
    event = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const type = event.type as string;
  const data = event.data as Record<string, unknown>;
  const obj = data.object as Record<string, unknown>;

  try {
    switch (type) {
      case "checkout.session.completed": {
        const customerId = obj.customer as string;
        const subscriptionId = obj.subscription as string;
        const orgId = (obj.metadata as Record<string, string>)?.organization_id;

        if (!orgId) break;

        const { data: org } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", orgId)
          .single();

        const existingSettings = (org?.settings as Record<string, unknown>) ?? {};
        await supabase
          .from("organizations")
          .update({ settings: { ...existingSettings, stripe_customer_id: customerId } })
          .eq("id", orgId);

        if (subscriptionId) {
          await handleSubscriptionChange(supabase, subscriptionId, undefined, orgId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await handleSubscriptionChange(supabase, obj.id as string, obj);
        break;
      }

      case "customer.subscription.deleted": {
        const customerId = obj.customer as string;
        const org = await findOrgByStripeCustomer(supabase, customerId);

        if (org) {
          await supabase
            .from("subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("organization_id", org.id)
            .in("status", ["active", "trialing", "past_due"]);
        }
        break;
      }

      case "invoice.payment_failed": {
        const customerId = obj.customer as string;
        const org = await findOrgByStripeCustomer(supabase, customerId);

        if (org) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("organization_id", org.id)
            .in("status", ["active", "trialing"]);
        }
        break;
      }

      // ── Stripe Connect Events ────────────────────────
      case "account.updated": {
        const accountId = obj.id as string;
        const chargesEnabled = obj.charges_enabled as boolean;
        const payoutsEnabled = obj.payouts_enabled as boolean;

        const { data: orgs } = await supabase
          .from("organizations")
          .select("id, settings");

        if (orgs) {
          for (const org of orgs) {
            const settings = (org.settings as Record<string, unknown>) ?? {};
            if (settings.stripe_account_id === accountId) {
              await supabase
                .from("organizations")
                .update({
                  settings: {
                    ...settings,
                    charges_enabled: chargesEnabled,
                    payouts_enabled: payoutsEnabled,
                    ...(chargesEnabled ? { connect_onboarded_at: new Date().toISOString() } : {}),
                  },
                })
                .eq("id", org.id);
              break;
            }
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const piId = obj.id as string;
        await supabase
          .from("payments")
          .update({ status: "succeeded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", piId);

        const { data: payment } = await supabase
          .from("payments")
          .select("invoice_id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();

        if (payment?.invoice_id) {
          await supabase
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", payment.invoice_id);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const piId = obj.id as string;
        await supabase
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", piId);
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook error [${type}]:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function handleSubscriptionChange(
  supabase: ReturnType<typeof createClient>,
  subscriptionId: string,
  subObj?: Record<string, unknown>,
  knownOrgId?: string,
) {
  const sub = subObj ?? {};
  const customerId = sub.customer as string;
  const status = sub.status as string;
  const items = sub.items as Record<string, unknown>;
  const itemData = (items?.data as Record<string, unknown>[]) ?? [];
  const priceId = (itemData[0]?.price as Record<string, unknown>)?.id as string;
  const planTier = getPlanFromPriceId(priceId);

  const periodStart = sub.current_period_start
    ? new Date((sub.current_period_start as number) * 1000).toISOString()
    : null;
  const periodEnd = sub.current_period_end
    ? new Date((sub.current_period_end as number) * 1000).toISOString()
    : null;

  let orgId = knownOrgId;
  if (!orgId && customerId) {
    const org = await findOrgByStripeCustomer(supabase, customerId);
    orgId = org?.id;
  }

  if (!orgId) return;

  const subRow = {
    organization_id: orgId,
    polar_subscription_id: `stripe_${subscriptionId}`,
    polar_product_id: priceId || null,
    plan_key: planTier,
    status: mapStripeStatus(status),
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: (sub.cancel_at_period_end as boolean) ?? false,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("polar_subscription_id", `stripe_${subscriptionId}`)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("subscriptions")
      .update(subRow)
      .eq("id", existing.id);
  } else {
    await supabase.from("subscriptions").insert({
      ...subRow,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    });
  }
}

function mapStripeStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case "active": return "active";
    case "past_due": return "past_due";
    case "canceled": return "canceled";
    case "incomplete": return "incomplete";
    case "trialing": return "trialing";
    default: return "incomplete";
  }
}
