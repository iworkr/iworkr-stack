/**
 * @module process-webhook-queue
 * @status COMPLETE
 * @auth UNSECURED — No user auth; service_role cron-triggered webhook processor
 * @description Aegis-Zero webhook queue processor: claims and processes batched webhooks from Stripe, RevenueCat, Resend with exponential backoff retry via RPC
 * @dependencies Stripe, RevenueCat, Resend, Supabase
 * @lastAudit 2026-03-22
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestEnv } from "../_shared/mockClients.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Aegis-Zero: Webhook Queue Processor
 *
 * Triggered by pg_cron every 1 minute (or manually via service_role).
 * Claims a batch of pending/retrying webhooks and processes them.
 * Failed items get exponential backoff via the fail_webhook() RPC.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: batch, error: claimErr } = await supabase.rpc(
      "claim_webhook_batch",
      { batch_size: isTestEnv ? 1 : 50, worker_id: `edge-${Date.now()}` },
    );

    if (claimErr) {
      console.error("[WebhookProcessor] Claim failed:", claimErr.message);
      return new Response(
        JSON.stringify({ error: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!batch || batch.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Queue empty" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[WebhookProcessor] Processing ${batch.length} webhooks`);

    let successCount = 0;
    let failCount = 0;

    for (const webhook of batch) {
      try {
        await processWebhook(webhook, supabase);
        await supabase.rpc("resolve_webhook", { webhook_id: webhook.id });
        successCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[WebhookProcessor] Failed ${webhook.provider}/${webhook.event_type}:`,
          message,
        );
        await supabase.rpc("fail_webhook", {
          webhook_id: webhook.id,
          error_message: message,
        });
        failCount++;
      }
    }

    return new Response(
      JSON.stringify({
        processed: batch.length,
        success: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WebhookProcessor] Fatal error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function processWebhook(
  webhook: {
    id: string;
    provider: string;
    event_type: string;
    payload: Record<string, unknown>;
    idempotency_key?: string | null;
  },
  supabase: ReturnType<typeof createClient>,
) {
  switch (webhook.provider) {
    case "stripe":
      await processStripeWebhook(webhook, supabase);
      break;
    case "polar":
      console.log(`[WebhookProcessor] Polar webhook (deprecated): ${webhook.event_type}`);
      break;
    case "revenuecat":
      await processRevenueCatWebhook(webhook, supabase);
      break;
    case "resend":
      await processResendWebhook(webhook, supabase);
      break;
    default:
      console.warn(`[WebhookProcessor] Unknown provider: ${webhook.provider}`);
  }
}

async function processStripeWebhook(
  webhook: { event_type: string; payload: Record<string, unknown>; idempotency_key?: string | null },
  supabase: ReturnType<typeof createClient>,
) {
  const payload = webhook.payload as Record<string, unknown>;

  const persistDlq = async (message: string) => {
    const stripeEventId =
      webhook.idempotency_key ||
      (payload.id as string | undefined) ||
      `${webhook.event_type}-${Date.now()}`;
    await supabase.from("stripe_webhook_failures").upsert(
      {
        stripe_event_id: stripeEventId,
        event_type: webhook.event_type,
        payload,
        error_message: message,
        resolved: false,
      },
      { onConflict: "stripe_event_id" }
    );
  };

  try {
    switch (webhook.event_type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = payload as Record<string, any>;
        const orgId = sub?.metadata?.organization_id as string | undefined;
        const subId = (sub?.id as string | undefined) || null;
        if (!orgId || !subId) {
          throw new Error(`[Stripe Queue] ${webhook.event_type}: missing org_id or subscription id`);
        }

        const item = (sub?.items?.data?.[0] as Record<string, any> | undefined) || {};
        const priceId =
          (item?.price?.id as string | undefined) ||
          (sub?.plan?.id as string | undefined) ||
          "";
        const periodStart =
          (item?.current_period_start as number | undefined) ||
          (sub?.current_period_start as number | undefined) ||
          (sub?.start_date as number | undefined);
        const periodEnd =
          (item?.current_period_end as number | undefined) ||
          (sub?.current_period_end as number | undefined);

        const statusMap: Record<string, string> = {
          active: "active",
          trialing: "trialing",
          past_due: "past_due",
          canceled: "canceled",
          incomplete: "incomplete",
          incomplete_expired: "incomplete_expired",
          unpaid: "unpaid",
          paused: "paused",
        };

        const { error: subErr } = await supabase.from("subscriptions").upsert(
          {
            organization_id: orgId,
            stripe_subscription_id: subId,
            stripe_price_id: priceId,
            plan_key: "free",
            status: statusMap[sub?.status as string] || "incomplete",
            current_period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : new Date().toISOString(),
            current_period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
            metadata: {
              stripe_subscription: subId,
              price_id: priceId,
              source: "stripe_queue",
            },
          },
          { onConflict: "stripe_subscription_id" }
        );
        if (subErr) throw new Error(`[Stripe Queue] subscription upsert failed: ${subErr.message}`);

        const orgUpdate: Record<string, unknown> = {
          billing_provider: "stripe",
        };
        if (periodEnd) {
          orgUpdate.subscription_active_until = new Date(periodEnd * 1000).toISOString();
        }
        const { error: orgErr } = await supabase
          .from("organizations")
          .update(orgUpdate)
          .eq("id", orgId);
        if (orgErr) throw new Error(`[Stripe Queue] org update failed: ${orgErr.message}`);

        console.log(`[Stripe Queue] Processed ${webhook.event_type} for org ${orgId}`);
        break;
      }
      case "customer.subscription.deleted": {
        const subId = payload.id as string;
        if (subId) {
          const { error: subDeleteErr } = await supabase
            .from("subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("stripe_subscription_id", subId);
          if (subDeleteErr) {
            throw new Error(`[Stripe Queue] subscription delete update failed: ${subDeleteErr.message}`);
          }
        }
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed":
      case "account.updated":
        console.log(`[Stripe Queue] Processed ${webhook.event_type}`);
        break;
      default:
        console.log(`[Stripe Queue] Unhandled: ${webhook.event_type}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await persistDlq(message);
    throw err;
  }
}

async function processRevenueCatWebhook(
  webhook: { event_type: string; payload: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>,
) {
  const payload = webhook.payload;
  const appUserId = (payload.app_user_id as string) || null;

  switch (webhook.event_type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE": {
      // Map RevenueCat entitlement to our subscription
      if (appUserId) {
        const entitlementId = (payload.entitlement_id as string) || "pro";
        const expiresDate = (payload.expiration_at_ms as number)
          ? new Date(payload.expiration_at_ms as number).toISOString()
          : null;

        await supabase
          .from("subscriptions")
          .update({
            status: "active",
            current_period_end: expiresDate,
            metadata: { ...payload, source: "revenuecat" },
          })
          .eq("revenuecat_app_user_id", appUserId);

        console.log(`[RevenueCat Queue] ${webhook.event_type}: ${appUserId} → ${entitlementId}`);
      }
      break;
    }
    case "CANCELLATION":
    case "EXPIRATION": {
      if (appUserId) {
        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("revenuecat_app_user_id", appUserId);
        console.log(`[RevenueCat Queue] ${webhook.event_type}: ${appUserId} → canceled`);
      }
      break;
    }
    default:
      console.log(`[RevenueCat Queue] Unhandled: ${webhook.event_type}`);
  }
}

async function processResendWebhook(
  webhook: { event_type: string; payload: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>,
) {
  const payload = webhook.payload;
  const emailLogId = (payload.email_log_id as string) || null;

  switch (webhook.event_type) {
    case "email.delivered": {
      if (emailLogId) {
        await supabase.from("email_logs").update({ status: "delivered" }).eq("id", emailLogId);
      }
      break;
    }
    case "email.bounced": {
      if (emailLogId) {
        await supabase.from("email_logs").update({ status: "bounced" }).eq("id", emailLogId);
      }
      const bouncedTo = (payload.to as string[]) || [];
      for (const email of bouncedTo) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
        if (profile) {
          await supabase.from("profiles").update({ email_bounced: true }).eq("id", profile.id);
        }
      }
      break;
    }
    case "email.complained": {
      if (emailLogId) {
        await supabase.from("email_logs").update({ status: "complained" }).eq("id", emailLogId);
      }
      break;
    }
    case "email.opened": {
      if (emailLogId) {
        const { data: existing } = await supabase.from("email_logs").select("metadata").eq("id", emailLogId).single();
        const meta = (existing?.metadata as Record<string, unknown>) ?? {};
        await supabase.from("email_logs").update({ metadata: { ...meta, opened_at: new Date().toISOString() } }).eq("id", emailLogId);
      }
      break;
    }
    default:
      console.log(`[Resend Queue] Unhandled: ${webhook.event_type}`);
  }
}
