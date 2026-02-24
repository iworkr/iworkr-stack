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

        await supabase
          .from("organizations")
          .update({ stripe_customer_id: customerId })
          .eq("id", orgId);

        if (subscriptionId) {
          await handleSubscriptionChange(supabase, subscriptionId);
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

        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (org) {
          await supabase
            .from("organizations")
            .update({ plan_tier: "free" })
            .eq("id", org.id);

          await supabase
            .from("subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("stripe_subscription_id", obj.id as string);
        }
        break;
      }

      case "invoice.payment_failed": {
        const customerId = obj.customer as string;
        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (org) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("organization_id", org.id)
            .in("status", ["active", "trialing"]);
        }
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
  subObj?: Record<string, unknown>
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

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!org) return;

  await supabase
    .from("organizations")
    .update({ plan_tier: planTier })
    .eq("id", org.id);

  const subRow = {
    organization_id: org.id,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
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
    .eq("stripe_subscription_id", subscriptionId)
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
