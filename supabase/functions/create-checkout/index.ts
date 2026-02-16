import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { organization_id, price_id, success_url, cancel_url } = await req.json();

    if (!organization_id || !price_id) {
      return new Response(
        JSON.stringify({ error: "organization_id and price_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the requesting user is admin/owner of the org
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(
        JSON.stringify({ error: "Only owners and admins can manage billing" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the organization
    const { data: org } = await adminClient
      .from("organizations")
      .select("polar_customer_id, name, slug")
      .eq("id", organization_id)
      .single();

    if (!org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const polarToken = Deno.env.get("POLAR_ACCESS_TOKEN");
    if (!polarToken) {
      return new Response(
        JSON.stringify({ error: "Billing not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create Polar customer
    let polar_customer_id = org.polar_customer_id;

    if (!polar_customer_id) {
      const customerRes = await fetch("https://api.polar.sh/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${polarToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          name: org.name,
          metadata: { organization_id, slug: org.slug },
        }),
      });

      if (!customerRes.ok) {
        const err = await customerRes.text();
        return new Response(
          JSON.stringify({ error: `Failed to create customer: ${err}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customer = await customerRes.json();
      polar_customer_id = customer.id;

      // Save customer ID back to org
      await adminClient
        .from("organizations")
        .update({ polar_customer_id })
        .eq("id", organization_id);
    }

    // Create checkout session
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";
    const checkoutRes = await fetch("https://api.polar.sh/v1/checkouts/custom", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${polarToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_price_id: price_id,
        customer_id: polar_customer_id,
        success_url: success_url || `${appUrl}/dashboard?checkout=success`,
        cancel_url: cancel_url || `${appUrl}/settings/billing`,
        metadata: { organization_id },
      }),
    });

    if (!checkoutRes.ok) {
      const err = await checkoutRes.text();
      return new Response(
        JSON.stringify({ error: `Failed to create checkout: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkout = await checkoutRes.json();

    // Audit log
    await adminClient.from("audit_log").insert({
      organization_id,
      user_id: user.id,
      action: "checkout.created",
      entity_type: "checkout",
      entity_id: checkout.id,
      new_data: { price_id, plan: checkout.metadata?.plan_key },
    });

    return new Response(
      JSON.stringify({ url: checkout.url, checkout_id: checkout.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
