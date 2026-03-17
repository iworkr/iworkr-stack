// process-payout Edge Function
// Triggers an instant payout from the connected Stripe account to the
// workspace's linked bank account.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-11-20.acacia",
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { orgId, amountCents } = await req.json();
    if (!orgId) return new Response(JSON.stringify({ error: "Missing orgId" }), { status: 400, headers: corsHeaders });

    // Owner/admin only
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403, headers: corsHeaders });
    }

    // Get connected account
    const { data: org } = await supabase
      .from("organizations")
      .select("stripe_account_id, settings, payouts_enabled")
      .eq("id", orgId)
      .single();

    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const accountId = org?.stripe_account_id || (settings.stripe_account_id as string);

    if (!accountId) return new Response(JSON.stringify({ error: "Stripe account not connected" }), { status: 400, headers: corsHeaders });
    if (!org?.payouts_enabled) return new Response(JSON.stringify({ error: "Payouts not enabled yet. Complete identity verification first." }), { status: 400, headers: corsHeaders });

    // Get available balance on connected account
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId });
    const available = balance.available.find((b) => b.currency === "aud");

    if (!available || available.amount === 0) {
      return new Response(JSON.stringify({ error: "No available balance to payout" }), { status: 400, headers: corsHeaders });
    }

    const payoutAmount = amountCents || available.amount;

    // Trigger payout
    const payout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency: "aud",
        metadata: { organization_id: orgId },
      },
      { stripeAccount: accountId }
    );

    return new Response(JSON.stringify({
      ok: true,
      payoutId: payout.id,
      amount: payout.amount,
      arrivalDate: payout.arrival_date,
      status: payout.status,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[process-payout]", error);
    const msg = error instanceof Stripe.errors.StripeError ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: corsHeaders });
  }
});
