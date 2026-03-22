/**
 * @module stripe-connect-onboard
 * @status COMPLETE
 * @auth SECURED — Validates JWT via Supabase auth
 * @description Creates/retrieves a Stripe Express account and returns an Account Link URL for KYC onboarding
 * @dependencies Supabase, Stripe Connect
 * @lastAudit 2026-03-22
 */
// stripe-connect-onboard Edge Function
// Creates/retrieves a Stripe Express account for a workspace and returns
// an Account Link URL for KYC onboarding.
// Also fixes the legacy settings JSONB inconsistency by writing to the real column.

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
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { orgId } = await req.json();
    if (!orgId) return new Response(JSON.stringify({ error: "Missing orgId" }), { status: 400, headers: corsHeaders });

    // Verify owner/admin
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Only owners and admins can activate iWorkr Connect" }), { status: 403, headers: corsHeaders });
    }

    // Get org
    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, stripe_account_id, settings, charges_enabled, payouts_enabled")
      .eq("id", orgId)
      .single();

    if (!org) return new Response(JSON.stringify({ error: "Workspace not found" }), { status: 404, headers: corsHeaders });

    // Resolve stripe account ID (real column first, then JSONB legacy fallback)
    const settings = (org.settings as Record<string, unknown>) ?? {};
    let accountId: string | null = org.stripe_account_id || (settings.stripe_account_id as string) || null;

    if (!accountId) {
      // Create new Stripe Express account
      const account = await stripe.accounts.create({
        type: "express",
        country: "AU",
        metadata: { organization_id: orgId },
        business_profile: { name: org.name || undefined },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Write to BOTH real column and settings JSONB (fixes legacy inconsistency)
      await supabase
        .from("organizations")
        .update({
          stripe_account_id: accountId,
          settings: { ...settings, stripe_account_id: accountId },
        })
        .eq("id", orgId);
    }

    const appUrl = Deno.env.get("APP_URL") || "https://www.iworkrapp.com";

    // Generate account link for KYC onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/finance/iworkr-connect?setup=refresh`,
      return_url: `${appUrl}/dashboard/finance/iworkr-connect?setup=success`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url, accountId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-connect-onboard]", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
