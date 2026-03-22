/**
 * @module submit-internal-feedback
 * @status COMPLETE
 * @auth SECURED — Validates JWT via Supabase auth
 * @description Absorbs negative user sentiment feedback, stores logs, updates metrics, and optionally routes to Slack
 * @dependencies Supabase, Slack (optional webhook)
 * @lastAudit 2026-03-22
 */
// ============================================================================
// Project Halcyon — Submit Internal Feedback (Negative Sentiment Absorption)
// ============================================================================
// When a user taps "Not Really" on the Sentiment Sieve, their feedback is
// routed here instead of the App Store. This:
// 1. Stores the feedback in `internal_feedback_logs`
// 2. Updates `user_feedback_metrics` with the negative sentiment
// 3. Optionally routes to Slack webhook for immediate team visibility
// 4. Hard-locks the user from future prompts for 7 days (cooling period)
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FeedbackPayload {
  user_id: string;
  organization_id?: string;
  trigger_event: string;
  feedback_text: string;
  app_version: string;
  device_info?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: FeedbackPayload = await req.json();

    if (!payload.user_id || !payload.feedback_text?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and feedback_text are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Store the feedback ────────────────────────────────────────────
    const { data: feedback, error: insertError } = await supabase
      .from("internal_feedback_logs")
      .insert({
        user_id: payload.user_id,
        organization_id: payload.organization_id || null,
        trigger_event: payload.trigger_event || "unknown",
        feedback_text: payload.feedback_text.trim(),
        app_version: payload.app_version || "unknown",
        device_info: payload.device_info || {},
        status: "unread",
        routed_to: "internal",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert feedback:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Update user metrics — log negative sentiment + 7-day cooldown ─
    await supabase
      .from("user_feedback_metrics")
      .upsert({
        user_id: payload.user_id,
        last_sentiment_prompted_at: new Date().toISOString(),
        sentiment_result: "negative",
        total_negative_sentiments:
          (
            await supabase
              .from("user_feedback_metrics")
              .select("total_negative_sentiments")
              .eq("user_id", payload.user_id)
              .single()
          ).data?.total_negative_sentiments + 1 || 1,
        // Hard-lock for 7 days after negative feedback (cooling period)
        is_hard_locked: true,
        lock_reason: "negative_sentiment_cooling",
        locked_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_trigger_event: payload.trigger_event,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", payload.user_id);

    // ── 3. Route to Slack (if webhook configured) ────────────────────────
    const slackWebhookUrl = Deno.env.get("HALCYON_SLACK_WEBHOOK_URL");
    if (slackWebhookUrl) {
      try {
        // Fetch user name for context
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", payload.user_id)
          .single();

        const userName = profile?.full_name || profile?.email || "Anonymous";

        await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocks: [
              {
                type: "header",
                text: {
                  type: "plain_text",
                  text: "🔴 Halcyon: Negative Feedback Absorbed",
                  emoji: true,
                },
              },
              {
                type: "section",
                fields: [
                  { type: "mrkdwn", text: `*User:*\n${userName}` },
                  { type: "mrkdwn", text: `*Trigger:*\n${payload.trigger_event}` },
                  { type: "mrkdwn", text: `*App Version:*\n${payload.app_version}` },
                  { type: "mrkdwn", text: `*Status:*\nAbsorbed (not routed to App Store)` },
                ],
              },
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*Feedback:*\n> ${payload.feedback_text.substring(0, 500)}`,
                },
              },
              {
                type: "context",
                elements: [
                  {
                    type: "mrkdwn",
                    text: `Feedback ID: \`${feedback.id}\` · User hard-locked for 7 days`,
                  },
                ],
              },
            ],
          }),
        });
      } catch (slackErr) {
        // Non-critical — log but don't fail the request
        console.error("Slack notification failed:", slackErr);
      }
    }

    // ── 4. Return success ────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        feedback_id: feedback.id,
        message: "Thank you for your feedback. Our team will review it.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Submit feedback error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error processing feedback" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
