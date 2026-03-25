/**
 * @module cron-auto-charge
 * @status COMPLETE
 * @auth SECURED — CRON_SECRET header or service-role JWT
 * @description Project Revenue-Net: Autonomous off-session payment sweeper.
 *   Runs daily via pg_cron. Queries invoices past their grace period,
 *   executes Stripe PaymentIntents off-session, and feeds the dunning
 *   waterfall on failure. Respects BECS async settlement, plan-managed
 *   NDIS bypasses, and idempotency via Stripe idempotency keys.
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { dispatchEvent } from "../_shared/dispatch.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

interface ChargeableInvoice {
  invoice_id: string;
  org_id: string;
  client_id: string;
  display_id: string;
  total: number;
  funding_type: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
  mandate_type: string | null;
  dunning_status: string;
  plan_manager_email: string | null;
}

interface ChargeResult {
  invoice_id: string;
  status: "charged" | "processing" | "failed" | "skipped";
  payment_intent_id?: string;
  error?: string;
  skip_reason?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
      },
    });
  }

  const cronSecret = req.headers.get("x-cron-secret") || "";
  const authHeader = req.headers.get("authorization") || "";

  if (cronSecret !== CRON_SECRET && !authHeader.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    const jwt = authHeader.replace("Bearer ", "");
    if (jwt !== SUPABASE_SERVICE_ROLE_KEY && cronSecret !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2024-04-10",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let body: { org_id?: string; invoice_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Cron invocations may have no body
  }

  const results: ChargeResult[] = [];

  try {
    // Fetch all eligible invoices via RPC
    const { data: invoices, error: fetchError } = await supabase.rpc(
      "get_auto_charge_invoices",
      body.org_id ? { p_org_id: body.org_id } : {}
    ) as { data: ChargeableInvoice[] | null; error: unknown };

    if (fetchError) throw fetchError;
    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ processed: 0, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Optional: filter to single invoice (manual retry)
    const targets = body.invoice_id
      ? invoices.filter((i) => i.invoice_id === body.invoice_id)
      : invoices;

    for (const inv of targets) {
      // ─── Guard: Plan-Managed NDIS → email plan manager, skip charge ───
      if (inv.funding_type === "plan_managed") {
        if (inv.plan_manager_email) {
          await dispatchEvent(supabase, {
            workspaceId: inv.org_id,
            eventType: "INVOICE_OVERDUE",
            recipient: { email: inv.plan_manager_email, clientId: inv.client_id },
            templateVariables: {
              invoice_number: inv.display_id,
              amount: `$${round2(inv.total).toFixed(2)}`,
            },
          });
        }
        results.push({
          invoice_id: inv.invoice_id,
          status: "skipped",
          skip_reason: "plan_managed_ndis",
        });
        continue;
      }

      // ─── Guard: NDIA-managed → skip (PRODA batch) ───
      if (inv.funding_type === "ndia_managed") {
        results.push({
          invoice_id: inv.invoice_id,
          status: "skipped",
          skip_reason: "ndia_managed_proda",
        });
        continue;
      }

      // ─── Guard: No active mandate ───
      if (!inv.stripe_payment_method_id || !inv.stripe_customer_id) {
        results.push({
          invoice_id: inv.invoice_id,
          status: "skipped",
          skip_reason: "no_active_mandate",
        });
        continue;
      }

      // ─── Fetch workspace Stripe Connect settings ───
      const { data: org } = await supabase
        .from("organizations")
        .select("settings")
        .eq("id", inv.org_id)
        .single();

      const settings = ((org as Record<string, unknown>)?.settings as Record<string, unknown>) ?? {};
      const stripeAccountId = settings.stripe_account_id as string | undefined;
      const chargesEnabled = settings.charges_enabled as boolean | undefined;
      const feePercent = parseFloat((settings.platform_fee_percent as string) || "0") || 1.0;

      const amountCents = Math.round(inv.total * 100);
      if (amountCents <= 0) {
        results.push({
          invoice_id: inv.invoice_id,
          status: "skipped",
          skip_reason: "zero_amount",
        });
        continue;
      }

      const idempotencyKey = `revnet_${inv.invoice_id}_${inv.dunning_status}`;

      try {
        const piParams: Stripe.PaymentIntentCreateParams = {
          amount: amountCents,
          currency: "aud",
          customer: inv.stripe_customer_id,
          payment_method: inv.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          metadata: {
            invoice_id: inv.invoice_id,
            organization_id: inv.org_id,
            source: "revenue_net_auto_charge",
          },
        };

        // Stripe Connect destination charges
        if (stripeAccountId && chargesEnabled) {
          const applicationFee = Math.round(amountCents * (feePercent / 100));
          piParams.application_fee_amount = applicationFee;
          piParams.transfer_data = { destination: stripeAccountId };
        }

        const paymentIntent = await stripe.paymentIntents.create(piParams, {
          idempotencyKey,
        });

        // Record in payments table
        await supabase.from("payments").insert({
          organization_id: inv.org_id,
          invoice_id: inv.invoice_id,
          stripe_payment_intent_id: paymentIntent.id,
          amount_cents: amountCents,
          currency: "aud",
          platform_fee_cents: piParams.application_fee_amount || 0,
          status: paymentIntent.status === "succeeded" ? "succeeded" : "processing",
        });

        if (paymentIntent.status === "succeeded") {
          // Credit card: instant settlement
          await supabase.rpc("mark_invoice_paid_via_stripe", {
            p_invoice_id: inv.invoice_id,
            p_payment_intent_id: paymentIntent.id,
          });

          // Queue for Ledger-Bridge/Xero sync
          await supabase.rpc("enqueue_ledger_sync", {
            p_org_id: inv.org_id,
            p_entity_type: "payment",
            p_entity_id: inv.invoice_id,
            p_action: "create",
            p_payload: {
              invoice_id: inv.invoice_id,
              amount: inv.total,
              payment_intent_id: paymentIntent.id,
            },
          }).catch(() => {});

          results.push({
            invoice_id: inv.invoice_id,
            status: "charged",
            payment_intent_id: paymentIntent.id,
          });
        } else {
          // BECS: "processing" — wait for async webhook
          await supabase.from("invoices").update({
            stripe_payment_intent_id: paymentIntent.id,
            status: "processing",
            updated_at: new Date().toISOString(),
          }).eq("id", inv.invoice_id);

          results.push({
            invoice_id: inv.invoice_id,
            status: "processing",
            payment_intent_id: paymentIntent.id,
          });
        }
      } catch (stripeErr: unknown) {
        const err = stripeErr as { type?: string; code?: string; message?: string };
        console.error(`[cron-auto-charge] Stripe error for invoice ${inv.invoice_id}:`, err);

        const errorMsg = err.message || "Unknown Stripe error";

        // Advance dunning waterfall
        const { data: nextStatus } = await supabase.rpc("advance_dunning", {
          p_invoice_id: inv.invoice_id,
          p_error_message: `${err.code || "error"}: ${errorMsg}`,
        }) as { data: string | null; error: unknown };

        // Fire Hermes-Matrix dunning notification
        const { data: client } = await supabase
          .from("clients")
          .select("email, phone, display_name")
          .eq("id", inv.client_id)
          .single();

        if (client) {
          const clientName = (client as Record<string, unknown>).display_name as string || "Client";
          const clientPhone = (client as Record<string, unknown>).phone as string;
          const clientEmail = (client as Record<string, unknown>).email as string;

          let eventType = "INVOICE_OVERDUE";
          let template = `Hi ${clientName}, your payment of $${round2(inv.total).toFixed(2)} for Invoice ${inv.display_id} failed (${err.code || "declined"}). We will retry in 2 days. Update your card: {{secure_link}}`;

          if (nextStatus === "FAIL_2") {
            template = `URGENT: Payment for Invoice ${inv.display_id} ($${round2(inv.total).toFixed(2)}) has failed again. To prevent service interruption, please update your payment method today: {{secure_link}}`;
          } else if (nextStatus === "FAIL_3") {
            eventType = "INVOICE_OVERDUE";
            template = `FINAL NOTICE: Invoice ${inv.display_id} ($${round2(inv.total).toFixed(2)}) remains unpaid. Your services have been paused until payment is received. Update your details: {{secure_link}}`;
          }

          await dispatchEvent(supabase, {
            workspaceId: inv.org_id,
            eventType,
            recipient: {
              phone: clientPhone,
              email: clientEmail,
              clientId: inv.client_id,
            },
            templateVariables: {
              client_name: clientName,
              invoice_number: inv.display_id,
              amount: `$${round2(inv.total).toFixed(2)}`,
              error_reason: err.code || "declined",
              secure_link: `${Deno.env.get("NEXT_PUBLIC_SITE_URL") || "https://app.iworkr.com"}/secure/mandate/${inv.client_id}`,
            },
            overrideSmsBody: template,
          });
        }

        results.push({
          invoice_id: inv.invoice_id,
          status: "failed",
          error: errorMsg,
        });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        charged: results.filter((r) => r.status === "charged").length,
        processing: results.filter((r) => r.status === "processing").length,
        failed: results.filter((r) => r.status === "failed").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        results,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[cron-auto-charge] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
