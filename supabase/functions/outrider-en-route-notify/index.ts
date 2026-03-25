/**
 * @module outrider-en-route-notify
 * @status COMPLETE
 * @auth SECURED — Uses withZodInterceptor + Zod schema validation
 * @description Project Outrider-Pulse — Initiates live tracking session, calculates ETA via
 *   Google Maps Distance Matrix, dispatches ClickSend SMS with tracking URL, updates job/shift status
 * @dependencies Supabase, ClickSend (SMS), Google Maps Distance Matrix API, Zod
 * @lastAudit 2026-03-24
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "npm:zod@3.23.8";
import { withZodInterceptor } from "../_shared/withZodInterceptor.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { dispatchEvent } from "../_shared/dispatch.ts";

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
  }, {
    message: "delay_minutes is required when target_status is DELAYED",
    path: ["delay_minutes"],
  });

// ── ClickSend SMS Dispatcher ──────────────────────────────────
async function sendClickSendSms(
  to: string,
  body: string,
  customString?: string,
): Promise<{ success: boolean; message_id?: string; error?: string }> {
  const username = Deno.env.get("CLICKSEND_USERNAME");
  const apiKey = Deno.env.get("CLICKSEND_API_KEY");

  if (!username || !apiKey) {
    console.error("[outrider] ClickSend credentials not configured");
    return { success: false, error: "ClickSend not configured" };
  }

  const auth = "Basic " + btoa(`${username}:${apiKey}`);

  try {
    const response = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        messages: [
          {
            source: "iWorkr",
            from: Deno.env.get("CLICKSEND_SENDER_ID") || "iWorkr",
            to,
            body: body.slice(0, 960),
            custom_string: customString || "",
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[outrider] ClickSend API error:", errBody);
      return { success: false, error: `ClickSend HTTP ${response.status}` };
    }

    const result = await response.json();
    const msg = result?.data?.messages?.[0];
    const messageId = msg?.message_id || null;
    const status = msg?.status || "unknown";

    return {
      success: status === "SUCCESS" || status === "success",
      message_id: messageId,
    };
  } catch (err) {
    console.error("[outrider] ClickSend dispatch error:", err);
    return { success: false, error: String(err) };
  }
}

// ── Fallback: Twilio SMS Dispatcher ───────────────────────────
async function sendTwilioSms(
  to: string,
  body: string,
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!twilioSid || !twilioAuth || !twilioFrom) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const smsParams = new URLSearchParams({
      To: to,
      From: twilioFrom,
      Body: body.slice(0, 1600),
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuth}`)}`,
        },
        body: smsParams.toString(),
      },
    );

    if (!res.ok) return { success: false, error: `Twilio HTTP ${res.status}` };
    const data = await res.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Google Maps ETA Calculator ────────────────────────────────
async function calculateEta(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<{ eta_minutes: number | null; distance_km: number | null }> {
  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    console.warn("[outrider] Google Maps API key not set, skipping ETA calc");
    return { eta_minutes: null, distance_km: null };
  }

  try {
    const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
    url.searchParams.set("origins", `${originLat},${originLng}`);
    url.searchParams.set("destinations", `${destLat},${destLng}`);
    url.searchParams.set("departure_time", "now");
    url.searchParams.set("traffic_model", "best_guess");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();
    const element = data?.rows?.[0]?.elements?.[0];

    if (element?.status === "OK") {
      const durationSec = element.duration_in_traffic?.value || element.duration?.value;
      const distanceM = element.distance?.value;
      return {
        eta_minutes: durationSec ? Math.ceil(durationSec / 60) : null,
        distance_km: distanceM ? Math.round((distanceM / 1000) * 10) / 10 : null,
      };
    }
    return { eta_minutes: null, distance_km: null };
  } catch (err) {
    console.error("[outrider] Google Maps ETA error:", err);
    return { eta_minutes: null, distance_km: null };
  }
}

serve(
  withZodInterceptor(OutriderNotifySchema, async (req, payload) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      // ── Auth Gate ──
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Missing auth token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await anonClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      let clientPhone: string | null = null;
      let clientName: string | null = null;
      let clientEmail: string | null = null;
      let workerName: string | null = null;
      let workerRole = "technician";
      let destinationAddress: string | null = null;
      let destinationLat: number | null = null;
      let destinationLng: number | null = null;
      let orgId: string | null = null;
      let orgName = "iWorkr";

      // ── Get worker profile ──
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", payload.worker_id)
        .single();
      workerName = profile?.full_name || "Your technician";

      if (payload.job_id) {
        // ── TRADE MODE ──
        const { data: job } = await supabase
          .from("jobs")
          .select(`
            title, location, location_lat, location_lng,
            site_lat, site_lng, organization_id,
            client_id,
            clients!client_id ( name, phone, email )
          `)
          .eq("id", payload.job_id)
          .single();

        if (job) {
          const client = (job as any).clients;
          clientPhone = client?.phone || null;
          clientName = client?.name || null;
          clientEmail = client?.email || null;
          destinationAddress = job.location || null;
          destinationLat = (job as any).site_lat || job.location_lat || null;
          destinationLng = (job as any).site_lng || job.location_lng || null;
          orgId = job.organization_id;
        }

        // Update job status
        await supabase
          .from("jobs")
          .update({
            status: payload.target_status === "DELAYED" ? "todo" : "en_route",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.job_id);
      }

      if (payload.shift_id) {
        // ── CARE MODE ──
        await supabase
          .from("schedule_blocks")
          .update({
            status: payload.target_status === "DELAYED" ? "confirmed" : "en_route",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.shift_id);

        const { data: shift } = await supabase
          .from("schedule_blocks")
          .select("title, client_name, location, organization_id")
          .eq("id", payload.shift_id)
          .single();

        if (shift) {
          destinationAddress = shift.location || null;
          clientName = shift.client_name || null;
          orgId = (shift as any).organization_id;
        }
        workerRole = "support worker";
      }

      // Get org name for branding
      if (orgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single();
        orgName = org?.name || "iWorkr";
      }

      // ── Create Tracking Session ──
      let trackingUrl: string | null = null;
      let sessionId: string | null = null;
      let etaMinutes: number | null = null;

      if (payload.job_id && payload.current_lat && payload.current_lng) {
        // Calculate ETA via Google Maps Distance Matrix
        if (destinationLat && destinationLng) {
          const eta = await calculateEta(
            payload.current_lat,
            payload.current_lng,
            destinationLat,
            destinationLng,
          );
          etaMinutes = eta.eta_minutes;
        }

        // Initiate tracking session via RPC
        const { data: sessionResult, error: sessionError } = await supabase.rpc(
          "initiate_tracking_session",
          {
            p_job_id: payload.job_id,
            p_worker_id: payload.worker_id,
            p_origin_lat: payload.current_lat,
            p_origin_lng: payload.current_lng,
          },
        );

        if (!sessionError && sessionResult?.success) {
          sessionId = sessionResult.session_id;
          const token = sessionResult.token;
          const baseUrl = Deno.env.get("TRACKING_BASE_URL") || "https://iworkr.app";
          trackingUrl = `${baseUrl}/track/${token}`;

          // Update ETA from Google Maps
          if (etaMinutes && sessionId) {
            await supabase
              .from("tracking_sessions")
              .update({
                eta_minutes: etaMinutes,
                eta_source: "google_maps",
                eta_calculated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);
          }

          // Override client phone/name from RPC result if needed
          clientPhone = sessionResult.client_phone || clientPhone;
          clientName = sessionResult.client_name || clientName;
        }
      }

      // ── Dispatch via Hermes Central Router ──
      let smsSent = false;
      let smsProvider: string | null = null;
      let smsMessageId: string | null = null;

      if (clientPhone && payload.target_status !== "DELAYED" && orgId) {
        const etaText = etaMinutes
          ? `approximately ${etaMinutes} minutes`
          : "shortly";

        const templateVars: Record<string, string> = {
          client_name: (clientName || "there").split(" ")[0],
          worker_name: workerName || "Your technician",
          org_name: orgName,
          eta: etaText,
          tracking_link: trackingUrl || "",
        };

        const fallbackBody = trackingUrl
          ? `Hi ${templateVars.client_name}, ${workerName} from ${orgName} is on the way and should arrive in ${etaText}. Track their arrival live: ${trackingUrl}`
          : `Hi ${templateVars.client_name}, your ${workerRole} ${workerName} from ${orgName} is en route and should arrive in ${etaText}.`;

        const dispatchResult = await dispatchEvent(supabase, {
          workspaceId: orgId,
          eventType: "OUTRIDER_EN_ROUTE",
          recipient: {
            phone: clientPhone,
            email: clientEmail || undefined,
            clientId: undefined,
          },
          templateVariables: templateVars,
          jobId: payload.job_id,
          overrideSmsBody: fallbackBody,
        });

        if (dispatchResult.sms?.sent) {
          smsSent = true;
          smsProvider = "clicksend";
          smsMessageId = dispatchResult.sms.message_id || null;
        } else if (clientPhone) {
          // Fallback to Twilio if Hermes dispatch failed
          const twilioResult = await sendTwilioSms(clientPhone, fallbackBody);
          if (twilioResult.success) {
            smsSent = true;
            smsProvider = "twilio";
            smsMessageId = twilioResult.sid || null;
          }
        }

        if (sessionId && smsSent) {
          await supabase
            .from("tracking_sessions")
            .update({
              sms_dispatched: true,
              sms_dispatched_at: new Date().toISOString(),
              sms_provider: smsProvider,
              sms_message_id: smsMessageId,
              sms_sid: smsMessageId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sessionId);
        }
      }

      // ── DELAYED handler: send delay notification ──
      if (clientPhone && payload.target_status === "DELAYED" && payload.delay_minutes) {
        const delayBody = `Hi ${(clientName || "there").split(" ")[0]}, your ${workerRole} ${workerName} from ${orgName} is running approximately ${payload.delay_minutes} minutes late. We apologise for the inconvenience.`;

        const delayResult = await sendClickSendSms(clientPhone, delayBody);
        if (!delayResult.success) {
          await sendTwilioSms(clientPhone, delayBody);
        }
      }

      // ── Log transit event ──
      if (orgId && payload.current_lat !== undefined && payload.current_lng !== undefined) {
        await supabase.from("vehicle_transit_logs").insert({
          user_id: payload.worker_id,
          organization_id: orgId,
          shift_id: payload.shift_id || payload.job_id,
          vehicle_id: payload.vehicle_id || null,
          connection_type: "mobile",
          connection_started_at: new Date().toISOString(),
          start_lat: payload.current_lat,
          start_lng: payload.current_lng,
          eta_sms_sent: smsSent,
          eta_sms_sent_at: smsSent ? new Date().toISOString() : null,
          eta_minutes_estimated: etaMinutes || payload.delay_minutes || null,
          handoff_route: payload.job_id
            ? `/jobs/${payload.job_id}/execute`
            : `/care/shift/${payload.shift_id}`,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          sms_sent: smsSent,
          sms_provider: smsProvider,
          sms_message_id: smsMessageId,
          tracking_url: trackingUrl,
          session_id: sessionId,
          eta_minutes: etaMinutes,
          client_name: clientName,
          destination: destinationAddress,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (err) {
      console.error("[outrider-en-route-notify] Error:", err);
      return new Response(
        JSON.stringify({ success: false, error: "En-route notification failed" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }, { providerHint: "outrider", bypassMethods: ["OPTIONS"] }),
);
