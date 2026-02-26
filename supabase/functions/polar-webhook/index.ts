import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 1. Read and verify the webhook signature
    const body = await req.text();
    const signature = req.headers.get("x-polar-signature") || req.headers.get("webhook-id");
    const secret = Deno.env.get("POLAR_WEBHOOK_SECRET");

    if (!secret) {
      console.error("POLAR_WEBHOOK_SECRET is not set");
      return new Response(
        JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Polar uses HMAC-SHA256 for webhook signatures
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expected) {
      console.error("Webhook signature mismatch");
      return new Response("Invalid signature", { status: 401 });
    }

    // 2. Parse the event
    const event = JSON.parse(body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Processing Polar event: ${event.type}`);

    // 3. Route by event type
    switch (event.type) {
      case "subscription.created": {
        const sub = event.data;
        const org_id = sub.metadata?.organization_id;
        if (!org_id) {
          console.warn("subscription.created missing organization_id in metadata");
          break;
        }

        const plan_key =
          sub.metadata?.plan_key ||
          sub.product?.name?.toLowerCase().replace(/\s+/g, "_") ||
          "unknown";

        await supabase.from("subscriptions").upsert(
          {
            organization_id: org_id,
            polar_subscription_id: sub.id,
            polar_product_id: sub.product_id || sub.product?.id,
            plan_key,
            status: sub.status === "active" ? "active" : "incomplete",
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end || false,
            metadata: sub,
          },
          { onConflict: "polar_subscription_id" }
        );

        await supabase.from("audit_log").insert({
          organization_id: org_id,
          action: "subscription.created",
          entity_type: "subscription",
          entity_id: sub.id,
          new_data: { plan_key, status: sub.status },
        });

        console.log(`Subscription created: ${sub.id} → org ${org_id} (${plan_key})`);
        break;
      }

      case "subscription.updated": {
        const sub = event.data;
        const org_id = sub.metadata?.organization_id;

        const plan_key =
          sub.metadata?.plan_key ||
          sub.product?.name?.toLowerCase().replace(/\s+/g, "_") ||
          undefined;

        const updateData: Record<string, unknown> = {
          status: sub.status,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end || false,
          metadata: sub,
        };
        if (plan_key) updateData.plan_key = plan_key;

        await supabase
          .from("subscriptions")
          .update(updateData)
          .eq("polar_subscription_id", sub.id);

        if (org_id) {
          await supabase.from("audit_log").insert({
            organization_id: org_id,
            action: "subscription.updated",
            entity_type: "subscription",
            entity_id: sub.id,
            new_data: { status: sub.status, period_end: sub.current_period_end },
          });
        }

        console.log(`Subscription updated: ${sub.id} → status=${sub.status}`);
        break;
      }

      case "subscription.revoked":
      case "subscription.canceled": {
        const sub = event.data;

        await supabase
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
          })
          .eq("polar_subscription_id", sub.id);

        const org_id = sub.metadata?.organization_id;
        if (org_id) {
          await supabase.from("audit_log").insert({
            organization_id: org_id,
            action: "subscription.canceled",
            entity_type: "subscription",
            entity_id: sub.id,
            new_data: { status: "canceled" },
          });
        }

        console.log(`Subscription canceled: ${sub.id}`);
        break;
      }

      case "customer.updated": {
        const customer = event.data;
        const org_id = customer.metadata?.organization_id;
        if (org_id) {
          await supabase
            .from("organizations")
            .update({ polar_customer_id: customer.id })
            .eq("id", org_id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
