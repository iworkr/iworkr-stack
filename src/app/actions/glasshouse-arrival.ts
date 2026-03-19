/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Glasshouse-Arrival — Uber-style Client Tracking System
// ═══════════════════════════════════════════════════════════════

// ── Helper ───────────────────────────────────────────────────

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/** Service-role Supabase client for public/unauthenticated access */
function createServiceClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Missing Supabase service role configuration");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ── Types ────────────────────────────────────────────────────

export type TrackingSession = {
  id: string;
  workspace_id: string;
  job_id: string;
  worker_id: string;
  client_id: string | null;
  secure_token: string;
  destination_lat: number | null;
  destination_lng: number | null;
  destination_address: string | null;
  worker_name: string | null;
  worker_avatar_url: string | null;
  worker_role: string | null;
  worker_phone_masked: string | null;
  vehicle_description: string | null;
  vehicle_registration: string | null;
  status: "active" | "arrived" | "cancelled" | "expired";
  current_lat: number | null;
  current_lng: number | null;
  current_heading: number | null;
  current_speed: number | null;
  eta_minutes: number | null;
  distance_remaining_km: number | null;
  is_off_route: boolean;
  off_route_message: string | null;
  last_position_update: string | null;
  position_update_count: number;
  sms_dispatched: boolean;
  created_at: string;
  expires_at: string;
  arrived_at: string | null;
};

export type TrackingPublicData = {
  status: string;
  session_id?: string;
  worker_name: string | null;
  worker_avatar_url: string | null;
  worker_role?: string | null;
  worker_phone_masked?: string | null;
  vehicle_description?: string | null;
  vehicle_registration?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  destination_address?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  current_heading?: number | null;
  current_speed?: number | null;
  eta_minutes?: number | null;
  distance_remaining_km?: number | null;
  is_off_route?: boolean;
  off_route_message?: string | null;
  last_position_update?: string | null;
  arrived_at?: string | null;
  error?: string;
  message?: string;
};

export type TrackingStats = {
  total_sessions: number;
  active: number;
  arrived: number;
  cancelled: number;
  expired: number;
  avg_eta_minutes: number | null;
  total_position_updates: number;
  sms_sent: number;
};

// ═══════════════════════════════════════════════════════════════
// 1) GET TRACKING SESSIONS
// ═══════════════════════════════════════════════════════════════

export async function getTrackingSessions(
  orgId: string,
  status?: string,
): Promise<{ data: TrackingSession[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("tracking_sessions")
      .select("*")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch tracking sessions" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 2) GET TRACKING SESSION DETAIL
// ═══════════════════════════════════════════════════════════════

export async function getTrackingSessionDetail(
  sessionId: string,
  orgId: string,
): Promise<{ data: TrackingSession | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("tracking_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch tracking session" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 3) INITIATE TRACKING SESSION
// ═══════════════════════════════════════════════════════════════

export async function initiateTrackingSession(
  orgId: string,
  jobId: string,
  workerId: string,
): Promise<{
  data: { session: TrackingSession; token: string; tracking_url: string } | null;
  error: string | null;
}> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("initiate_tracking_session", {
      p_workspace_id: orgId,
      p_job_id: jobId,
      p_worker_id: workerId,
    });

    if (error) throw error;

    const session = data as TrackingSession;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/track/${session.secure_token}`;

    revalidatePath("/dashboard/tracking");

    return {
      data: {
        session,
        token: session.secure_token,
        tracking_url: trackingUrl,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to initiate tracking session" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 4) UPDATE TRACKING POSITION
//    No strict auth — called from Flutter background service
// ═══════════════════════════════════════════════════════════════

export async function updateTrackingPosition(
  sessionId: string,
  lat: number,
  lng: number,
  heading?: number,
  speed?: number,
  accuracy?: number,
): Promise<{ data: any | null; error: string | null }> {
  try {
    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient as any).rpc("update_tracking_position", {
      p_session_id: sessionId,
      p_lat: lat,
      p_lng: lng,
      p_heading: heading ?? null,
      p_speed: speed ?? null,
      p_accuracy: accuracy ?? null,
    });

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update tracking position" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 5) TERMINATE TRACKING SESSION
// ═══════════════════════════════════════════════════════════════

export async function terminateTrackingSession(
  sessionId: string,
  reason?: string,
): Promise<{ data: any | null; error: string | null }> {
  try {
    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient as any).rpc("terminate_tracking_session", {
      p_session_id: sessionId,
      p_reason: reason ?? "manual",
    });

    if (error) throw error;

    revalidatePath("/dashboard/tracking");

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to terminate tracking session" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 6) GET TRACKING BY TOKEN (PUBLIC — NO AUTH)
//    Used by /track/[token] page for client-facing view
// ═══════════════════════════════════════════════════════════════

export async function getTrackingByToken(
  token: string,
): Promise<{ data: TrackingPublicData | null; error: string | null }> {
  try {
    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient as any).rpc("get_tracking_by_token", {
      p_token: token,
    });

    if (error) throw error;

    return { data: data as TrackingPublicData, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch tracking data" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 7) GET TRACKING STATS
// ═══════════════════════════════════════════════════════════════

export async function getTrackingStats(
  orgId: string,
): Promise<{ data: TrackingStats | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_tracking_stats", {
      p_workspace_id: orgId,
    });

    if (error) throw error;

    return { data: data as TrackingStats, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch tracking stats" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 8) GET ACTIVE SESSION FOR JOB
// ═══════════════════════════════════════════════════════════════

export async function getActiveSessionForJob(
  jobId: string,
  orgId: string,
): Promise<{ data: TrackingSession | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("tracking_sessions")
      .select("*")
      .eq("job_id", jobId)
      .eq("workspace_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch active session for job" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 9) CANCEL TRACKING SESSION
// ═══════════════════════════════════════════════════════════════

export async function cancelTrackingSession(
  sessionId: string,
  orgId: string,
): Promise<{ data: any | null; error: string | null }> {
  try {
    await assertOrgMember(orgId);

    const result = await terminateTrackingSession(sessionId, "cancelled");

    if (result.error) throw new Error(result.error);

    revalidatePath("/dashboard/tracking");
    revalidatePath("/dashboard/jobs");

    return { data: result.data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to cancel tracking session" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 10) GET POSITION HISTORY
// ═══════════════════════════════════════════════════════════════

export async function getPositionHistory(
  sessionId: string,
  orgId: string,
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("tracking_position_log")
      .select("*")
      .eq("session_id", sessionId)
      .order("recorded_at", { ascending: true })
      .limit(500);

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch position history" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 11) MARK SMS DISPATCHED
// ═══════════════════════════════════════════════════════════════

export async function markSmsDispatched(
  sessionId: string,
  smsSid: string,
): Promise<{ data: any | null; error: string | null }> {
  try {
    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient as any)
      .from("tracking_sessions")
      .update({
        sms_dispatched: true,
        sms_sid: smsSid,
      })
      .eq("id", sessionId)
      .select()
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to mark SMS as dispatched" };
  }
}

// ═══════════════════════════════════════════════════════════════
// 12) EXPIRE STALE TRACKING SESSIONS
// ═══════════════════════════════════════════════════════════════

export async function expireStaleTrackingSessions(): Promise<{
  data: { expired_count: number } | null;
  error: string | null;
}> {
  try {
    const serviceClient = createServiceClient();

    const { data, error } = await (serviceClient as any)
      .from("tracking_sessions")
      .update({ status: "expired" })
      .lt("expires_at", new Date().toISOString())
      .eq("status", "active")
      .select("id");

    if (error) throw error;

    const expiredCount = data?.length ?? 0;

    return { data: { expired_count: expiredCount }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to expire stale tracking sessions" };
  }
}
