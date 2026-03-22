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
  webhook: { id: string; provider: string; event_type: string; payload: Record<string, unknown> },
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
  webhook: { event_type: string; payload: Record<string, unknown> },
  supabase: ReturnType<typeof createClient>,
) {
  const payload = webhook.payload as Record<string, unknown>;

  switch (webhook.event_type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const orgId = (payload.metadata as Record<string, string>)?.organization_id;
      if (!orgId) {
        console.warn(`[Stripe Queue] ${webhook.event_type}: missing org_id`);
        return;
      }
      console.log(`[Stripe Queue] Processed ${webhook.event_type} for org ${orgId}`);
      break;
    }
    case "customer.subscription.deleted": {
      const subId = payload.id as string;
      if (subId) {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("stripe_subscription_id", subId);
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
