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
    // Validate the request — invoked by pg_cron (every 6 hours) or admin
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const polarToken = Deno.env.get("POLAR_ACCESS_TOKEN");
    if (!polarToken) {
      return new Response(
        JSON.stringify({ error: "Polar not configured — POLAR_ACCESS_TOKEN is missing" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    // Fetch all local subscriptions that are active or past_due
    const { data: localSubs, error: subsError } = await adminClient
      .from("subscriptions")
      .select("id, organization_id, polar_subscription_id, status, current_period_end, plan_key")
      .in("status", ["active", "past_due", "trialing"]);

    if (subsError) throw subsError;

    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const localSub of localSubs || []) {
      try {
        // Fetch current subscription state from Polar
        const polarRes = await fetch(
          `https://api.polar.sh/v1/subscriptions/${localSub.polar_subscription_id}`,
          {
            headers: {
              Authorization: `Bearer ${polarToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!polarRes.ok) {
          console.error(
            `Failed to fetch Polar subscription ${localSub.polar_subscription_id}: ${polarRes.status}`
          );
          errors++;
          continue;
        }

        const polarSub = await polarRes.json();
        synced++;

        // Determine if an update is needed
        const newStatus = polarSub.status === "active" ? "active"
          : polarSub.status === "past_due" ? "past_due"
          : polarSub.status === "trialing" ? "trialing"
          : polarSub.status === "canceled" || polarSub.status === "revoked" ? "canceled"
          : polarSub.status === "incomplete" ? "incomplete"
          : localSub.status;

        const periodEnd = polarSub.current_period_end || localSub.current_period_end;
        const cancelAtPeriodEnd = polarSub.cancel_at_period_end || false;

        const needsUpdate =
          newStatus !== localSub.status ||
          periodEnd !== localSub.current_period_end ||
          cancelAtPeriodEnd !== (localSub as Record<string, unknown>).cancel_at_period_end;

        if (needsUpdate) {
          const updatePayload: Record<string, unknown> = {
            status: newStatus,
            current_period_start: polarSub.current_period_start,
            current_period_end: periodEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            metadata: polarSub,
          };

          if (newStatus === "canceled") {
            updatePayload.canceled_at = new Date().toISOString();
          }

          const { error: updateError } = await adminClient
            .from("subscriptions")
            .update(updatePayload)
            .eq("id", localSub.id);

          if (updateError) {
            console.error(`Failed to update subscription ${localSub.id}:`, updateError);
            errors++;
          } else {
            updated++;

            // Audit the status change
            await adminClient.from("audit_log").insert({
              organization_id: localSub.organization_id,
              action: "subscription.synced",
              entity_type: "subscription",
              entity_id: localSub.polar_subscription_id,
              new_data: {
                old_status: localSub.status,
                new_status: newStatus,
                period_end: periodEnd,
              },
            });
          }
        }
      } catch (subErr) {
        console.error(`Error syncing subscription ${localSub.polar_subscription_id}:`, subErr);
        errors++;
      }
    }

    // Also check for orgs with polar_customer_id but no active subscription
    // (in case a subscription was created outside our webhook flow)
    const { data: orgsWithCustomer } = await adminClient
      .from("organizations")
      .select("id, polar_customer_id")
      .not("polar_customer_id", "is", null);

    let newSubsFound = 0;

    for (const org of orgsWithCustomer || []) {
      // Check if org already has an active local subscription
      const { data: existingSub } = await adminClient
        .from("subscriptions")
        .select("id")
        .eq("organization_id", org.id)
        .in("status", ["active", "past_due", "trialing"])
        .limit(1)
        .single();

      if (existingSub) continue;

      // Fetch subscriptions for this customer from Polar
      try {
        const customerSubsRes = await fetch(
          `https://api.polar.sh/v1/subscriptions?customer_id=${org.polar_customer_id}&active=true`,
          {
            headers: {
              Authorization: `Bearer ${polarToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!customerSubsRes.ok) continue;

        const customerSubs = await customerSubsRes.json();
        const items = customerSubs.items || customerSubs.result || [];

        for (const polarSub of items) {
          if (polarSub.status !== "active" && polarSub.status !== "trialing") continue;

          const plan_key =
            polarSub.metadata?.plan_key ||
            polarSub.product?.name?.toLowerCase().replace(/\s+/g, "_") ||
            "unknown";

          await adminClient.from("subscriptions").upsert(
            {
              organization_id: org.id,
              polar_subscription_id: polarSub.id,
              polar_product_id: polarSub.product_id || polarSub.product?.id,
              plan_key,
              status: polarSub.status === "active" ? "active" : "trialing",
              current_period_start: polarSub.current_period_start,
              current_period_end: polarSub.current_period_end,
              cancel_at_period_end: polarSub.cancel_at_period_end || false,
              metadata: polarSub,
            },
            { onConflict: "polar_subscription_id" }
          );

          newSubsFound++;
        }
      } catch {
        // Non-fatal: customer lookup may fail for stale IDs
      }
    }

    // Audit the sync run
    await adminClient.from("audit_log").insert({
      action: "cron.sync_polar_status",
      entity_type: "system",
      new_data: { synced, updated, errors, new_subs_found: newSubsFound },
    });

    console.log(
      `Polar sync complete: ${synced} checked, ${updated} updated, ${newSubsFound} new, ${errors} errors`
    );

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        updated,
        new_subs_found: newSubsFound,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Polar sync error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
