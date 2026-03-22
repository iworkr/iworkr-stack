/**
 * @module OutriderAutonomous Server Actions
 * @status COMPLETE
 * @description Autonomous vehicle fleet operations — route planning, geofence management, autonomous dispatch, and safety monitoring
 * @exports createRouteAction, fetchRoutesAction, updateGeofenceAction, fetchAutonomousFleetAction, triggerEmergencyStopAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" };
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, user: null, error: "Not a member" };
  return { supabase, user, error: null };
}

/* ══════════════════════════════════════════════════════
   ANOMALY MANAGEMENT
   ══════════════════════════════════════════════════════ */

export async function reportAnomaly(orgId: string, params: {
  worker_id: string;
  worker_name?: string;
  anomaly_type: string;
  delay_minutes: number;
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("fleet_anomalies")
    .insert({
      organization_id: orgId,
      worker_id: params.worker_id,
      worker_name: params.worker_name ?? null,
      anomaly_type: params.anomaly_type,
      delay_minutes: params.delay_minutes,
      status: "DETECTED",
    })
    .select("id")
    .single();

  if (dbErr) return { data: null, error: dbErr.message };

  const anomalyId = (data as { id: string }).id;

  // Trigger the arbitrator edge function
  supabase.functions.invoke("agent-outrider-arbitrator", {
    body: {
      anomaly_id: anomalyId,
      organization_id: orgId,
      worker_id: params.worker_id,
      worker_name: params.worker_name,
      anomaly_type: params.anomaly_type,
      delay_minutes: params.delay_minutes,
    },
  }).catch(() => { /* fire and forget */ });

  revalidatePath("/dashboard/dispatch/live");
  return { data: { id: anomalyId }, error: null };
}

export async function getAnomalies(orgId: string, filters?: {
  status?: string;
  limit?: number;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  let query = (supabase as SupabaseClient)
    .from("fleet_anomalies")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  query = query.limit(filters?.limit ?? 50);

  const { data, error: dbErr } = await query;
  return { data: (data ?? []) as Record<string, unknown>[], error: dbErr?.message ?? null };
}

export async function getAnomalyDetail(orgId: string, anomalyId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const [anomalyRes, eventsRes, negsRes] = await Promise.all([
    (supabase as SupabaseClient).from("fleet_anomalies").select("*").eq("id", anomalyId).eq("organization_id", orgId).maybeSingle(),
    (supabase as SupabaseClient).from("arbitration_events").select("*").eq("anomaly_id", anomalyId).order("created_at", { ascending: true }),
    (supabase as SupabaseClient).from("autonomous_negotiations").select("*").eq("anomaly_id", anomalyId).order("created_at", { ascending: true }),
  ]);

  return {
    data: {
      anomaly: anomalyRes.data as Record<string, unknown> | null,
      events: (eventsRes.data ?? []) as Record<string, unknown>[],
      negotiations: (negsRes.data ?? []) as Record<string, unknown>[],
    },
    error: anomalyRes.error?.message ?? null,
  };
}

/* ── Manual Override ─────────────────────────────────── */

export async function overrideAnomaly(orgId: string, anomalyId: string) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  await (supabase as SupabaseClient).from("fleet_anomalies").update({
    status: "MANUAL_OVERRIDE",
    resolved_by: "HUMAN",
    resolved_at: new Date().toISOString(),
    autopilot_active: false,
    updated_at: new Date().toISOString(),
  }).eq("id", anomalyId).eq("organization_id", orgId);

  await (supabase as SupabaseClient).from("arbitration_events").insert({
    organization_id: orgId,
    anomaly_id: anomalyId,
    event_type: "MANUAL_OVERRIDE",
    severity: "warning",
    message: "Dispatcher manually overrode Autopilot for this anomaly.",
    worker_id: user.id,
  });

  revalidatePath("/dashboard/dispatch/live");
  return { error: null };
}

/* ══════════════════════════════════════════════════════
   AUTOPILOT CONTROLS
   ══════════════════════════════════════════════════════ */

export async function toggleAutopilot(orgId: string, enabled: boolean) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  await (supabase as SupabaseClient).from("organizations").update({
    autopilot_enabled: enabled,
    autopilot_halted_at: enabled ? null : new Date().toISOString(),
  }).eq("id", orgId);

  if (!enabled) {
    // Cancel all pending negotiations
    await (supabase as SupabaseClient)
      .from("autonomous_negotiations")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .in("status", ["AWAITING_CLIENT", "NEGOTIATING", "SMS_DISPATCHED"]);

    await (supabase as SupabaseClient).from("arbitration_events").insert({
      organization_id: orgId,
      event_type: "AUTOPILOT_HALTED",
      severity: "critical",
      message: "AUTOPILOT HALTED by dispatcher. All pending negotiations cancelled. Manual control active.",
      worker_id: user.id,
    });
  } else {
    await (supabase as SupabaseClient).from("arbitration_events").insert({
      organization_id: orgId,
      event_type: "AUTOPILOT_ENABLED",
      severity: "success",
      message: "Autopilot re-enabled. AI arbitration is active.",
      worker_id: user.id,
    });
  }

  revalidatePath("/dashboard/dispatch/live");
  return { error: null };
}

export async function getAutopilotStatus(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data } = await (supabase as SupabaseClient)
    .from("organizations")
    .select("autopilot_enabled, autopilot_halted_at, autopilot_care_mode, autopilot_max_radius_km")
    .eq("id", orgId)
    .maybeSingle();

  return { data: data as Record<string, unknown> | null, error: null };
}

/* ══════════════════════════════════════════════════════
   TERMINAL EVENT FEED
   ══════════════════════════════════════════════════════ */

export async function getArbitrationEvents(orgId: string, opts?: {
  anomaly_id?: string;
  limit?: number;
  since?: string;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  let query = (supabase as SupabaseClient)
    .from("arbitration_events")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (opts?.anomaly_id) query = query.eq("anomaly_id", opts.anomaly_id);
  if (opts?.since) query = query.gte("created_at", opts.since);
  query = query.limit(opts?.limit ?? 100);

  const { data, error: dbErr } = await query;
  return { data: (data ?? []) as Record<string, unknown>[], error: dbErr?.message ?? null };
}

/* ══════════════════════════════════════════════════════
   DISPATCH STATS
   ══════════════════════════════════════════════════════ */

export async function getDispatchStats(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const [active, resolved, escalated, total] = await Promise.all([
    (supabase as SupabaseClient).from("fleet_anomalies").select("id", { count: "exact" }).eq("organization_id", orgId).in("status", ["DETECTED", "ANALYZING_SPATIAL", "EXECUTING_ARBITRATION", "NEGOTIATING_CLIENT"]),
    (supabase as SupabaseClient).from("fleet_anomalies").select("id", { count: "exact" }).eq("organization_id", orgId).eq("status", "RESOLVED"),
    (supabase as SupabaseClient).from("autonomous_negotiations").select("id", { count: "exact" }).eq("organization_id", orgId).eq("status", "FAILED_ESCALATED"),
    (supabase as SupabaseClient).from("fleet_anomalies").select("id", { count: "exact" }).eq("organization_id", orgId),
  ]);

  return {
    data: {
      active_anomalies: active.count ?? 0,
      resolved: resolved.count ?? 0,
      escalated: escalated.count ?? 0,
      total: total.count ?? 0,
    },
    error: null,
  };
}
