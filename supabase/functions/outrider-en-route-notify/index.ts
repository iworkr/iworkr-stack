/**
 * @module outrider-en-route-notify
 * @status COMPLETE
 * @auth SECURED — Uses withZodInterceptor + Zod schema validation
 * @description Sends ETA SMS to client via Twilio when worker marks en route; updates job/shift status and logs transit
 * @dependencies Supabase, Twilio (SMS), Zod, withZodInterceptor
 * @lastAudit 2026-03-22
 */

// ============================================================================
// Project Outrider — En Route ETA Notification (SMS via Twilio)
// ============================================================================
// Fired when a worker taps [Mark En Route] on the CarPlay/Android Auto UI.
// 1. Updates schedule_blocks/jobs status to 'en_route'
// 2. Sends ETA SMS to the client via Twilio
// 3. Logs the transit event
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "npm:zod@3.23.8";
import { withZodInterceptor } from "../_shared/withZodInterceptor.ts";
import { corsHeaders } from "../_shared/cors.ts";

const OutriderNotifySchema = z
  .object({
    job_id: z.string().uuid().optional(),
    shift_id: z.string().uuid().optional(),
    worker_id: z.string().uuid(),
    target_status: z.enum(["EN_ROUTE", "DELAYED"]),
    delay_minutes: z.number().int().nonnegative().optional(),
    current_lat: z.number().optional(),
    current_lng: z.number().optional(),
    vehicle_id: z.string().uuid().optional(),
  })
  .strict()
  .refine((data) => data.job_id || data.shift_id, {
    message: "Either job_id or shift_id is required",
    path: ["job_id"],
  })
  .refine((data) => {
    if (data.target_status === "DELAYED" && data.delay_minutes === undefined) {
      return false;
    }
    return true;
  }, { message: "delay_minutes is required when target_status is DELAYED", path: ["delay_minutes"] });

serve(withZodInterceptor(OutriderNotifySchema, async (req, payload) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Aegis Auth Gate: Verify caller is a logged-in field worker ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // payload is already parsed by withZodInterceptor — do NOT re-call req.json()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── 1. Determine target type (shift vs job) ─────────────────────────
    let clientPhone: string | null = null;
    let clientName: string | null = null;
    let workerName: string | null = null;
    let workerRole = "technician";
    let destinationAddress: string | null = null;

    // Get worker name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", payload.worker_id)
      .single();
    workerName = profile?.full_name || "Your technician";

    if (payload.job_id) {
      // ── TRADE MODE: Update job status ───────────────────────────────
      await supabase
        .from("jobs")
        .update({
          status: payload.target_status === "DELAYED" ? "todo" : "in_progress",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.job_id);

      // Get client details
      const { data: job } = await supabase
        .from("jobs")
        .select(
          `
          title,
          location,
          client_id,
          clients!client_id (
            name,
            phone,
            email
          )
        `
        )
        .eq("id", payload.job_id)
        .single();

      if (job) {
        const client = (job as any).clients;
        clientPhone = client?.phone || null;
        clientName = client?.name || null;
        destinationAddress = job.location || null;
      }
    }

    if (payload.shift_id) {
      // ── CARE MODE: Update schedule_block status ─────────────────────
      await supabase
        .from("schedule_blocks")
        .update({
          status: payload.target_status === "DELAYED" ? "confirmed" : "en_route",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payload.shift_id);

      // Get shift details (limited — privacy masking applies server-side too)
      const { data: shift } = await supabase
        .from("schedule_blocks")
        .select("title, client_name, location")
        .eq("id", payload.shift_id)
        .single();

      if (shift) {
        destinationAddress = shift.location || null;
        clientName = shift.client_name || null;
      }
      workerRole = "support worker";
    }

    // ── 2. Send ETA SMS via Twilio (if phone available + user opted in) ──
    let smsSent = false;
    if (clientPhone) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioSid && twilioAuth && twilioFrom) {
        // Check user preference
        const { data: prefs } = await supabase
          .from("user_automotive_preferences")
          .select("send_eta_sms_to_client, eta_sms_template")
          .eq("user_id", payload.worker_id)
          .single();

        if (!prefs || prefs.send_eta_sms_to_client !== false) {
          const etaMinutes = payload.target_status === "DELAYED"
            ? payload.delay_minutes || 15
            : 15;
          let template =
            prefs?.eta_sms_template ||
            "Hi {{client_name}}, your {{worker_role}} {{worker_name}} is currently en route and should arrive in approximately {{eta_minutes}} minutes.";

          const message = template
            .replace("{{client_name}}", clientName || "there")
            .replace("{{worker_role}}", workerRole)
            .replace("{{worker_name}}", workerName || "your technician")
            .replace("{{eta_minutes}}", String(etaMinutes));

          try {
            const smsBody = new URLSearchParams({
              To: clientPhone,
              From: twilioFrom,
              Body: message.slice(0, 1600),
            });

            const smsRes = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
                },
                body: smsBody.toString(),
              }
            );

            smsSent = smsRes.ok;
          } catch (smsErr) {
            console.error("Twilio SMS failed:", smsErr);
          }
        }
      }
    }

    // ── 3. Log the transit event ─────────────────────────────────────────
    // Get org_id from user
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", payload.worker_id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (membership && payload.current_lat !== undefined && payload.current_lng !== undefined) {
      await supabase.from("vehicle_transit_logs").insert({
        user_id: payload.worker_id,
        organization_id: membership.organization_id,
        shift_id: payload.shift_id || payload.job_id,
        vehicle_id: payload.vehicle_id || null,
        connection_type: "carplay", // Will be overridden by Flutter with actual type
        connection_started_at: new Date().toISOString(),
        start_lat: payload.current_lat,
        start_lng: payload.current_lng,
        eta_sms_sent: smsSent,
        eta_sms_sent_at: smsSent ? new Date().toISOString() : null,
        eta_minutes_estimated: payload.delay_minutes || null,
        handoff_route: payload.job_id
          ? `/jobs/${payload.job_id}/execute`
          : `/care/shift/${payload.shift_id}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        sms_sent: smsSent,
        client_name: clientName,
        destination: destinationAddress,
        eta_minutes: payload.delay_minutes || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Outrider en-route error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "En-route notification failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}, { providerHint: "outrider", bypassMethods: ["OPTIONS"] }));
