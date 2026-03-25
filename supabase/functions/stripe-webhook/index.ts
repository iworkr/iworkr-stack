/**
 * @module stripe-webhook
 * @status COMPLETE
 * @auth SECURED — Validates Stripe webhook signature via STRIPE_WEBHOOK_SECRET
 * @description Handles Stripe webhook events (checkout, subscription, invoice) and syncs plan status to workspaces
 * @dependencies Supabase, Stripe
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestEnv } from "../_shared/mockClients.ts";

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

async function findOrgByStripeCustomer(
  supabase: ReturnType<typeof createClient>,
  customerId: string,
): Promise<{ id: string; settings: Record<string, unknown> } | null> {
  // Use JSONB contains filter for indexed lookup instead of full table scan
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, settings")
    .contains("settings", { stripe_customer_id: customerId })
    .limit(1);

  if (!orgs || orgs.length === 0) return null;

  const org = orgs[0];
  return { id: org.id, settings: (org.settings as Record<string, unknown>) ?? {} };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature && !isTestEnv) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();
  let event: Record<string, unknown>;

  try {
    event = isTestEnv
      ? JSON.parse(body)
      : await verifyStripeSignature(body, signature || "", STRIPE_WEBHOOK_SECRET);
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

        // Use JSONB contains filter for indexed lookup instead of full table scan
        const { data: matchedOrgs } = await supabase
          .from("organizations")
          .select("id, settings")
          .contains("settings", { stripe_account_id: accountId })
          .limit(1);

        if (matchedOrgs && matchedOrgs.length > 0) {
          const org = matchedOrgs[0];
          const settings = (org.settings as Record<string, unknown>) ?? {};
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
        }
        break;
      }

      case "payment_intent.succeeded": {
        const piId = obj.id as string;
        const piMeta = (obj.metadata as Record<string, string>) ?? {};

        await supabase
          .from("payments")
          .update({ status: "succeeded", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", piId);

        // Revenue-Net: If this PI was created by auto-charge, use the RPC
        if (piMeta.source === "revenue_net_auto_charge" && piMeta.invoice_id) {
          await supabase.rpc("mark_invoice_paid_via_stripe", {
            p_invoice_id: piMeta.invoice_id,
            p_payment_intent_id: piId,
          });

          // Queue for Ledger-Bridge/Xero sync
          try {
            await supabase.rpc("enqueue_ledger_sync", {
              p_org_id: piMeta.organization_id || "",
              p_entity_type: "payment",
              p_entity_id: piMeta.invoice_id,
              p_action: "create",
              p_payload: {
                invoice_id: piMeta.invoice_id,
                payment_intent_id: piId,
              },
            });
          } catch { /* non-fatal */ }
          break;
        }

        // Legacy path: lookup via payments table
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
        const piMeta = (obj.metadata as Record<string, string>) ?? {};

        await supabase
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("stripe_payment_intent_id", piId);

        // Revenue-Net dunning waterfall for off-session charges
        if (piMeta.source === "revenue_net_auto_charge" && piMeta.invoice_id) {
          const lastError = (obj.last_payment_error as Record<string, unknown>);
          const errorCode = (lastError?.code as string) || "card_declined";
          const errorMsg = (lastError?.message as string) || "Payment failed";

          await supabase.rpc("advance_dunning", {
            p_invoice_id: piMeta.invoice_id,
            p_error_message: `${errorCode}: ${errorMsg}`,
          });
        }
        break;
      }

      // Revenue-Net: Handle SetupIntent completion → save mandate
      case "setup_intent.succeeded": {
        const siMeta = (obj.metadata as Record<string, string>) ?? {};
        const pmId = obj.payment_method as string;
        const customerId = obj.customer as string;

        if (siMeta.mandate_flow === "revenue_net" && siMeta.client_id && siMeta.organization_id && pmId) {
          // Revoke any existing default mandates for this client
          await supabase
            .from("payment_mandates")
            .update({ is_default: false, updated_at: new Date().toISOString() })
            .eq("client_id", siMeta.client_id)
            .eq("is_default", true);

          const mandateType = siMeta.mandate_type === "BECS_DEBIT" ? "BECS_DEBIT" : "CREDIT_CARD";

          await supabase.from("payment_mandates").insert({
            organization_id: siMeta.organization_id,
            client_id: siMeta.client_id,
            stripe_customer_id: customerId,
            stripe_payment_method_id: pmId,
            stripe_setup_intent_id: obj.id as string,
            mandate_type: mandateType,
            status: "ACTIVE",
            is_default: true,
            card_brand: siMeta.card_brand || null,
            last4: siMeta.last4 || null,
            exp_month: siMeta.exp_month ? parseInt(siMeta.exp_month) : null,
            exp_year: siMeta.exp_year ? parseInt(siMeta.exp_year) : null,
            bsb_last4: siMeta.bsb_last4 || null,
            account_last4: siMeta.account_last4 || null,
          });

          // If client was suspended, trigger immediate sweep for overdue invoices
          const { data: clientData } = await supabase
            .from("clients")
            .select("is_financially_suspended")
            .eq("id", siMeta.client_id)
            .single();

          if ((clientData as Record<string, unknown>)?.is_financially_suspended) {
            // Trigger manual sweep via the cron function
            const fnUrl = `${SUPABASE_URL}/functions/v1/cron-auto-charge`;
            fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "x-cron-secret": Deno.env.get("CRON_SECRET") || "",
              },
              body: JSON.stringify({ org_id: siMeta.organization_id }),
            }).catch(() => {});
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook error [${type}]:`, err);

    // ── DLQ: Route failed payloads to webhook_dead_letters for retry ──
    try {
      await supabase.from("webhook_dead_letters").insert({
        source: "stripe",
        event_type: type,
        payload: { type, data },
        error_message: err instanceof Error ? err.message : String(err),
        status: "FAILED_REQUIRES_RETRY",
        created_at: new Date().toISOString(),
      });
    } catch (dlqErr) {
      console.error("[stripe-webhook] DLQ insert also failed:", dlqErr);
    }

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
