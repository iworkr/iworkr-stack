// ============================================================================
// Project Halcyon — Evaluate User Eligibility for App Review Prompt
// ============================================================================
// The mobile app calls this Edge Function before presenting the Sentiment Sieve.
// This function delegates the heavy lifting to the PostgreSQL RPC
// `evaluate_halcyon_eligibility` which enforces all firewall checks.
//
// POST { user_id: string, trigger_event: string }
// Returns { eligible: boolean, reason?: string, score?: number, ... }
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, trigger_event } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ eligible: false, reason: "missing_user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Call the PostgreSQL RPC (all firewall logic lives in SQL) ──────
    const { data: eligibility, error: rpcError } = await supabase.rpc(
      "evaluate_halcyon_eligibility",
      {
        p_user_id: user_id,
        p_trigger_event: trigger_event || "manual",
      }
    );

    if (rpcError) {
      console.error("Halcyon RPC error:", rpcError);
      // Fail closed — if we can't evaluate, don't prompt
      return new Response(
        JSON.stringify({ eligible: false, reason: "evaluation_error", detail: rpcError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Additional OS-level checks (native API constraints) ────────────
    // Apple allows max 3 native prompts per 365 days.
    // We enforce this server-side as a secondary guard.
    if (eligibility?.eligible) {
      const { data: metrics } = await supabase
        .from("user_feedback_metrics")
        .select("native_review_count_365d, last_native_review_requested_at")
        .eq("user_id", user_id)
        .single();

      if (metrics) {
        // Check if native review count exceeds Apple's limit
        if ((metrics.native_review_count_365d || 0) >= 3) {
          // Check if the oldest review was within 365 days
          if (metrics.last_native_review_requested_at) {
            const daysSince =
              (Date.now() - new Date(metrics.last_native_review_requested_at).getTime()) /
              (1000 * 3600 * 24);
            if (daysSince < 365) {
              return new Response(
                JSON.stringify({
                  eligible: false,
                  reason: "native_api_throttle",
                  detail: "Maximum 3 native review prompts per 365 days (Apple StoreKit limit)",
                  days_until_reset: Math.ceil(365 - daysSince),
                }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
    }

    // ── 3. Return eligibility verdict ────────────────────────────────────
    return new Response(JSON.stringify(eligibility), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Halcyon evaluation error:", err);
    // Fail closed — never prompt on error
    return new Response(
      JSON.stringify({ eligible: false, reason: "internal_error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
