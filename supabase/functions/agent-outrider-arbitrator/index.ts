// Edge Function: agent-outrider-arbitrator
// Project Outrider-Autonomous — Spatial-Temporal Arbitration Engine
// Pipeline: Anomaly → Blast Radius → PostGIS Spatial Match → Silent Reassignment → SMS Fallback

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  anomalyId: string,
  eventType: string,
  severity: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  await supabase.from("arbitration_events").insert({
    organization_id: orgId,
    anomaly_id: anomalyId,
    event_type: eventType,
    severity,
    message,
    job_id: (meta.job_id as string) ?? null,
    worker_id: (meta.worker_id as string) ?? null,
    target_worker_id: (meta.target_worker_id as string) ?? null,
    metadata: meta,
  });
}

async function sendTwilioSms(
  to: string,
  body: string
): Promise<{ sid: string } | null> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return null;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const params = new URLSearchParams({
    To: to,
    From: TWILIO_PHONE_NUMBER,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return { sid: data.sid };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      anomaly_id,
      organization_id,
      worker_id,
      worker_name,
      anomaly_type,
      delay_minutes,
      radius_km = 15,
      care_mode = false,
    } = body as {
      anomaly_id: string;
      organization_id: string;
      worker_id: string;
      worker_name?: string;
      anomaly_type: string;
      delay_minutes: number;
      radius_km?: number;
      care_mode?: boolean;
    };

    if (!anomaly_id || !organization_id || !worker_id) {
      return new Response(
        JSON.stringify({ error: "anomaly_id, organization_id, worker_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check autopilot not halted
    const { data: org } = await supabase
      .from("organizations")
      .select("autopilot_enabled, autopilot_halted_at, autopilot_care_mode, autopilot_max_radius_km")
      .eq("id", organization_id)
      .maybeSingle();

    if (org?.autopilot_halted_at) {
      await logEvent(supabase, organization_id, anomaly_id, "AUTOPILOT_HALTED",
        "warning", "Autopilot is halted. Skipping arbitration.");
      return new Response(
        JSON.stringify({ status: "HALTED", message: "Autopilot is currently halted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveRadius = (org?.autopilot_max_radius_km ?? radius_km) * 1000;
    const isCareMode = org?.autopilot_care_mode ?? care_mode;

    await logEvent(supabase, organization_id, anomaly_id, "ANOMALY_DETECTED",
      "critical",
      `CRITICAL: ${worker_name ?? worker_id} reported ${anomaly_type}. Delay: ${delay_minutes}m.`,
      { worker_id });

    // Update anomaly status
    await supabase.from("fleet_anomalies").update({
      status: "ANALYZING_SPATIAL",
      updated_at: new Date().toISOString(),
    }).eq("id", anomaly_id);

    // Step 1: Calculate blast radius
    const { data: blastRadius } = await supabase.rpc("calculate_blast_radius", {
      p_org_id: organization_id,
      p_worker_id: worker_id,
      p_delay_minutes: delay_minutes,
    });

    const impactedJobs = (blastRadius ?? []) as {
      job_id: string | null;
      job_title: string | null;
      client_name: string | null;
      start_time: string;
      end_time: string;
      location: string | null;
    }[];

    const impactedJobIds = impactedJobs
      .map((j) => j.job_id)
      .filter(Boolean) as string[];

    await logEvent(supabase, organization_id, anomaly_id, "BLAST_RADIUS",
      "warning",
      `Calculating blast radius... ${impactedJobs.length} jobs impacted.`,
      { impacted_count: impactedJobs.length, impacted_job_ids: impactedJobIds });

    await supabase.from("fleet_anomalies").update({
      impacted_job_ids: impactedJobIds,
      impacted_job_count: impactedJobs.length,
      status: "EXECUTING_ARBITRATION",
      updated_at: new Date().toISOString(),
    }).eq("id", anomaly_id);

    const resolvedJobs: string[] = [];
    const failedJobs: { job_id: string; client_name: string | null; start_time: string; location: string | null }[] = [];

    // Step 2: Attempt spatial arbitration for each impacted job
    for (const job of impactedJobs) {
      if (!job.job_id) continue;

      await logEvent(supabase, organization_id, anomaly_id, "ARBITRATION_START",
        "info",
        `Executing Spatial Arbitration for Job: ${job.job_title ?? job.job_id}.`,
        { job_id: job.job_id });

      // Get job location for spatial query
      const { data: jobData } = await supabase
        .from("jobs")
        .select("location_lat, location_lng")
        .eq("id", job.job_id)
        .maybeSingle();

      const jobLat = (jobData as Record<string, unknown>)?.location_lat as number | null;
      const jobLng = (jobData as Record<string, unknown>)?.location_lng as number | null;

      if (!jobLat || !jobLng) {
        await logEvent(supabase, organization_id, anomaly_id, "SPATIAL_FAIL",
          "warning", `No GPS coordinates for job ${job.job_title}. Skipping spatial.`,
          { job_id: job.job_id });
        failedJobs.push(job as typeof failedJobs[0]);
        continue;
      }

      // Get required skills from the schedule block
      const { data: blockData } = await supabase
        .from("schedule_blocks")
        .select("metadata")
        .eq("job_id", job.job_id)
        .eq("technician_id", worker_id)
        .eq("organization_id", organization_id)
        .neq("status", "cancelled")
        .maybeSingle();

      const requiredSkills =
        ((blockData?.metadata as Record<string, unknown>)?.required_skills as string[]) ?? [];

      // Execute PostGIS spatial query
      const { data: candidates } = await supabase.rpc("find_eligible_workers_spatial", {
        p_org_id: organization_id,
        p_excluded_worker: worker_id,
        p_job_lat: jobLat,
        p_job_lng: jobLng,
        p_radius_meters: effectiveRadius,
        p_required_skills: requiredSkills,
        p_job_start: job.start_time,
        p_job_end: job.end_time,
        p_care_mode: isCareMode,
      });

      const matches = (candidates ?? []) as {
        worker_id: string;
        worker_name: string;
        distance_meters: number;
        skills: string[];
      }[];

      if (matches.length === 0) {
        await logEvent(supabase, organization_id, anomaly_id, "NO_SPATIAL_MATCH",
          "warning",
          `Arbitration failed for Job: ${job.job_title}. No qualified workers with capacity within ${radius_km}km.`,
          { job_id: job.job_id });
        failedJobs.push(job as typeof failedJobs[0]);
        continue;
      }

      const bestMatch = matches[0];
      const distKm = (bestMatch.distance_meters / 1000).toFixed(1);

      // Execute silent reassignment
      const { error: reassignErr } = await supabase
        .from("schedule_blocks")
        .update({
          technician_id: bestMatch.worker_id,
          metadata: {
            ...((blockData?.metadata as Record<string, unknown>) ?? {}),
            ai_reassigned: true,
            original_worker_id: worker_id,
            reassigned_at: new Date().toISOString(),
            anomaly_id: anomaly_id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", job.job_id)
        .eq("technician_id", worker_id)
        .eq("organization_id", organization_id)
        .neq("status", "cancelled");

      if (reassignErr) {
        await logEvent(supabase, organization_id, anomaly_id, "REASSIGN_FAIL",
          "error", `Failed to reassign Job ${job.job_title}: ${reassignErr.message}`,
          { job_id: job.job_id });
        failedJobs.push(job as typeof failedJobs[0]);
        continue;
      }

      resolvedJobs.push(job.job_id);

      await logEvent(supabase, organization_id, anomaly_id, "SILENT_REASSIGNMENT",
        "success",
        `[SUCCESS] Job "${job.job_title}" silently transferred to ${bestMatch.worker_name}. Distance: ${distKm}km. Skills: Verified.`,
        {
          job_id: job.job_id,
          worker_id: worker_id,
          target_worker_id: bestMatch.worker_id,
          distance_km: distKm,
        });
    }

    // Step 3: For failed jobs, initiate SMS negotiation
    for (const job of failedJobs) {
      if (!job.job_id) continue;

      // Get client info
      const { data: jobInfo } = await supabase
        .from("jobs")
        .select("client_id")
        .eq("id", job.job_id)
        .maybeSingle();

      const clientId = (jobInfo as Record<string, unknown>)?.client_id as string | null;
      if (!clientId) continue;

      const { data: clientData } = await supabase
        .from("clients")
        .select("name, phone")
        .eq("id", clientId)
        .maybeSingle();

      const clientName = (clientData as Record<string, unknown>)?.name as string ?? "Client";
      const clientPhone = (clientData as Record<string, unknown>)?.phone as string | null;

      if (!clientPhone) {
        await logEvent(supabase, organization_id, anomaly_id, "SMS_SKIP",
          "warning", `No phone number for client ${clientName}. Cannot negotiate.`,
          { job_id: job.job_id });
        continue;
      }

      // Get org name for the SMS
      const { data: orgData } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organization_id)
        .maybeSingle();
      const orgName = (orgData as Record<string, unknown>)?.name as string ?? "our team";

      const delayedEta = new Date(
        new Date(job.start_time).getTime() + delay_minutes * 60000
      );
      const etaStr = delayedEta.toLocaleTimeString("en-AU", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      const smsBody =
        `Hi ${clientName.split(" ")[0]}, this is the automated dispatch assistant for ${orgName}. ` +
        `Unfortunately, your technician ${worker_name ?? "assigned worker"} has experienced a ${anomaly_type.toLowerCase().replace(/_/g, " ")} ` +
        `and is running about ${delay_minutes} minutes late. ` +
        `Would ${etaStr} still work for you today, or would you prefer to reschedule?`;

      const twilioResult = await sendTwilioSms(clientPhone, smsBody);

      // Create negotiation record
      await supabase.from("autonomous_negotiations").insert({
        organization_id: organization_id,
        anomaly_id: anomaly_id,
        job_id: job.job_id,
        client_id: clientId,
        client_name: clientName,
        client_phone: clientPhone,
        twilio_thread_id: twilioResult?.sid ?? null,
        original_datetime: job.start_time,
        agent_context: {
          worker_name: worker_name,
          anomaly_type,
          delay_minutes,
          org_name: orgName,
          offered_eta: delayedEta.toISOString(),
        },
        conversation_history: [{
          role: "assistant",
          content: smsBody,
          timestamp: new Date().toISOString(),
        }],
        turn_count: 1,
        status: "AWAITING_CLIENT",
      });

      await logEvent(supabase, organization_id, anomaly_id, "SMS_DISPATCHED",
        "info",
        `Initiating SMS negotiation with ${clientName} for Job: ${job.job_title ?? job.job_id}.`,
        { job_id: job.job_id, client_name: clientName });
    }

    // Update final anomaly status
    const finalStatus =
      failedJobs.length === 0
        ? "RESOLVED"
        : failedJobs.length === impactedJobs.length
        ? "NEGOTIATING_CLIENT"
        : "NEGOTIATING_CLIENT";

    await supabase.from("fleet_anomalies").update({
      status: finalStatus,
      resolved_job_ids: resolvedJobs,
      resolved_by: resolvedJobs.length > 0 ? "AUTOPILOT" : null,
      resolved_at: finalStatus === "RESOLVED" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", anomaly_id);

    if (finalStatus === "RESOLVED") {
      await logEvent(supabase, organization_id, anomaly_id, "ANOMALY_RESOLVED",
        "success",
        `All ${impactedJobs.length} impacted jobs resolved via silent reassignment.`);
    }

    return new Response(
      JSON.stringify({
        anomaly_id,
        status: finalStatus,
        impacted_count: impactedJobs.length,
        resolved_count: resolvedJobs.length,
        negotiating_count: failedJobs.length,
        resolved_job_ids: resolvedJobs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
