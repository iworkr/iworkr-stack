import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

const ENTITLEMENT_MAP: Record<string, string> = {
  entitlement_pro: "pro",
  entitlement_enterprise: "business",
};

function detectStore(store: string): "apple" | "google" {
  return store === "PLAY_STORE" ? "google" : "apple";
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (RC_WEBHOOK_SECRET && authHeader !== `Bearer ${RC_WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const event = body.event;

  if (!event) {
    return new Response("No event payload", { status: 400 });
  }

  const {
    type,
    app_user_id,
    entitlement_ids,
    store,
    expiration_at_ms,
    original_app_user_id,
  } = event;

  const workspaceId = app_user_id;
  if (!workspaceId) {
    return new Response("Missing app_user_id", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const billingProvider = store ? detectStore(store) : "apple";

  try {
    switch (type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
      case "UNCANCELLATION": {
        const entitlementId = entitlement_ids?.[0] ?? "";
        const planTier = ENTITLEMENT_MAP[entitlementId] ?? "pro";

        const activeUntil = expiration_at_ms
          ? new Date(expiration_at_ms).toISOString()
          : null;

        const { data: orgData } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", workspaceId)
          .single();

        const existingSettings = (orgData?.settings as Record<string, unknown>) ?? {};
        await supabase
          .from("organizations")
          .update({
            settings: {
              ...existingSettings,
              billing_provider: billingProvider,
              rc_original_app_user_id: original_app_user_id ?? workspaceId,
              subscription_active_until: activeUntil,
            },
          })
          .eq("id", workspaceId);

        const rcSubId = `rc_${original_app_user_id ?? workspaceId}`;
        const { data: existingSub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("polar_subscription_id", rcSubId)
          .maybeSingle();

        const subRow = {
          organization_id: workspaceId,
          polar_subscription_id: rcSubId,
          plan_key: planTier,
          status: "active" as const,
          current_period_end: activeUntil,
          updated_at: new Date().toISOString(),
        };

        if (existingSub) {
          await supabase.from("subscriptions").update(subRow).eq("id", existingSub.id);
        } else {
          await supabase.from("subscriptions").insert({
            ...subRow,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
          });
        }

        break;
      }

      case "CANCELLATION":
      case "EXPIRATION": {
        await supabase
          .from("subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("organization_id", workspaceId)
          .neq("status", "canceled");

        break;
      }

      case "BILLING_ISSUE": {
        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("organization_id", workspaceId)
          .neq("status", "canceled");

        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("RevenueCat webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
