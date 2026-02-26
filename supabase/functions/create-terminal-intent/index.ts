import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { orgId, amountCents, currency, invoiceId } = await req.json();
    if (!orgId || !amountCents) {
      return new Response(
        JSON.stringify({ error: "Missing orgId or amountCents" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return new Response(
        JSON.stringify({ error: "Not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: org } = await adminClient
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const stripeAccountId = settings.stripe_account_id as string | undefined;
    const chargesEnabled = settings.charges_enabled as boolean | undefined;

    if (!stripeAccountId || !chargesEnabled) {
      return new Response(
        JSON.stringify({ error: "Stripe Connect not enabled for this workspace" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const feePercent = parseFloat((settings.platform_fee_percent as string) || "0") || 1.0;
    const applicationFee = Math.round(amountCents * (feePercent / 100));

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: currency || "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        application_fee_amount: applicationFee,
        metadata: {
          organization_id: orgId,
          invoice_id: invoiceId || "",
          source: "tap_to_pay",
        },
      },
      { stripeAccount: stripeAccountId }
    );

    // Record the pending payment
    await adminClient.from("payments").insert({
      organization_id: orgId,
      invoice_id: invoiceId || null,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: amountCents,
      currency: currency || "usd",
      platform_fee_cents: applicationFee,
      status: "pending",
      source: "tap_to_pay",
      created_by: user.id,
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-terminal-intent error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
