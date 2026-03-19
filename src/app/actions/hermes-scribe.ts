"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Auth Helper ─────────────────────────────────────── */

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
   AUDIO DEBRIEF ACTIONS
   ══════════════════════════════════════════════════════ */

export async function createAudioDebrief(orgId: string, params: {
  job_id?: string;
  participant_id?: string;
  client_id?: string;
  sector?: string;
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .insert({
      organization_id: orgId,
      worker_id: user.id,
      job_id: params.job_id ?? null,
      participant_id: params.participant_id ?? null,
      client_id: params.client_id ?? null,
      sector: params.sector ?? "care",
      audio_url: "",
      status: "UPLOADING",
    })
    .select("id")
    .single();

  return { data: data as { id: string } | null, error: dbErr?.message ?? null };
}

export async function getAudioDebriefs(orgId: string, filters?: {
  status?: string;
  job_id?: string;
  worker_id?: string;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  let query = (supabase as SupabaseClient)
    .from("audio_debriefs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.job_id) query = query.eq("job_id", filters.job_id);
  if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id);

  const { data, error: dbErr } = await query.limit(50);
  return { data: (data ?? []) as Record<string, unknown>[], error: dbErr?.message ?? null };
}

export async function getDebriefDetail(orgId: string, debriefId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .select("*")
    .eq("id", debriefId)
    .eq("organization_id", orgId)
    .maybeSingle();

  return { data: data as Record<string, unknown> | null, error: dbErr?.message ?? null };
}

/* ── Trigger Voice Router ────────────────────────────── */

export async function triggerVoiceRouter(orgId: string, debriefId: string, params: {
  audio_storage_path: string;
  sector?: string;
  context_names?: string[];
  context_medications?: string[];
  context_goals?: string[];
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  // Update audio URL
  await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .update({
      audio_url: params.audio_storage_path,
      status: "TRANSCRIBING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", debriefId);

  // Invoke edge function
  const { error: fnErr } = await supabase.functions.invoke("semantic-voice-router", {
    body: {
      debrief_id: debriefId,
      organization_id: orgId,
      audio_storage_path: params.audio_storage_path,
      sector: params.sector ?? "care",
      context_names: params.context_names ?? [],
      context_medications: params.context_medications ?? [],
      context_goals: params.context_goals ?? [],
    },
  });

  revalidatePath("/dashboard/ambient");
  return { error: fnErr?.message ?? null };
}

/* ── Update Proposed Action (Edit before commit) ─────── */

export async function updateProposedAction(orgId: string, debriefId: string, actionIndex: number, updatedData: Record<string, unknown>) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { data: debrief } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .select("proposed_actions")
    .eq("id", debriefId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!debrief) return { error: "Debrief not found" };

  const actions = (debrief.proposed_actions as Record<string, unknown>[]) ?? [];
  if (actionIndex < 0 || actionIndex >= actions.length) return { error: "Invalid action index" };

  actions[actionIndex] = { ...actions[actionIndex], data: updatedData };

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .update({
      proposed_actions: actions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debriefId);

  return { error: dbErr?.message ?? null };
}

/* ── Remove Proposed Action ──────────────────────────── */

export async function removeProposedAction(orgId: string, debriefId: string, actionIndex: number) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { data: debrief } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .select("proposed_actions")
    .eq("id", debriefId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!debrief) return { error: "Debrief not found" };

  const actions = (debrief.proposed_actions as Record<string, unknown>[]) ?? [];
  actions.splice(actionIndex, 1);

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .update({
      proposed_actions: actions,
      updated_at: new Date().toISOString(),
    })
    .eq("id", debriefId);

  return { error: dbErr?.message ?? null };
}

/* ── Approve & Commit (Atomic HITL) ──────────────────── */

export async function approveAndCommitDebrief(orgId: string, debriefId: string, params: {
  job_id?: string;
  participant_id?: string;
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data: debrief } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .select("proposed_actions, status")
    .eq("id", debriefId)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (!debrief) return { data: null, error: "Debrief not found" };
  if ((debrief.status as string) !== "PENDING_REVIEW") {
    return { data: null, error: `Cannot commit debrief in status: ${debrief.status}` };
  }

  const actions = (debrief.proposed_actions as Record<string, unknown>[]) ?? [];
  if (actions.length === 0) return { data: null, error: "No actions to commit" };

  // Enrich actions with job/participant context
  const enrichedActions = actions.map((a) => {
    const data = (a.data ?? {}) as Record<string, unknown>;
    return {
      ...a,
      data: undefined,
      action_type: a.action_type,
      confidence: a.confidence,
      job_id: data.job_id ?? params.job_id ?? null,
      participant_id: data.participant_id ?? params.participant_id ?? null,
      ...data,
    };
  });

  // Execute atomic commit via RPC
  const { data: result, error: rpcErr } = await (supabase as SupabaseClient).rpc("commit_audio_debrief", {
    p_debrief_id: debriefId,
    p_org_id: orgId,
    p_worker_id: user.id,
    p_actions: enrichedActions,
  });

  if (rpcErr) return { data: null, error: rpcErr.message };

  revalidatePath("/dashboard/ambient");
  revalidatePath("/dashboard/care");
  return { data: result as Record<string, unknown>, error: null };
}

/* ── Reject Debrief ──────────────────────────────────── */

export async function rejectDebrief(orgId: string, debriefId: string) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("audio_debriefs")
    .update({
      status: "REJECTED",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", debriefId)
    .eq("organization_id", orgId);

  revalidatePath("/dashboard/ambient");
  return { error: dbErr?.message ?? null };
}

/* ══════════════════════════════════════════════════════
   VISION HAZARD SCAN ACTIONS
   ══════════════════════════════════════════════════════ */

export async function createVisionScan(orgId: string, params: {
  job_id?: string;
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("vision_hazard_scans")
    .insert({
      organization_id: orgId,
      worker_id: user.id,
      job_id: params.job_id ?? null,
      status: "SCANNING",
    })
    .select("id")
    .single();

  return { data: data as { id: string } | null, error: dbErr?.message ?? null };
}

export async function triggerVisionAnalysis(orgId: string, scanId: string, frameStoragePaths: string[]) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  await (supabase as SupabaseClient)
    .from("vision_hazard_scans")
    .update({
      frame_urls: frameStoragePaths,
      frame_count: frameStoragePaths.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanId);

  const { error: fnErr } = await supabase.functions.invoke("vision-hazard-analyzer", {
    body: {
      scan_id: scanId,
      organization_id: orgId,
      frame_storage_paths: frameStoragePaths,
    },
  });

  revalidatePath("/dashboard/ops/safety");
  return { error: fnErr?.message ?? null };
}

export async function getVisionScan(orgId: string, scanId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("vision_hazard_scans")
    .select("*")
    .eq("id", scanId)
    .eq("organization_id", orgId)
    .maybeSingle();

  return { data: data as Record<string, unknown> | null, error: dbErr?.message ?? null };
}

export async function commitVisionToSwms(orgId: string, scanId: string, params: {
  job_id: string;
  hazards: Record<string, unknown>[];
  ppe: string[];
  site_conditions: string[];
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  // Create a SWMS record from the vision analysis
  const { error: swmsErr } = await (supabase as SupabaseClient)
    .from("job_swms_records")
    .insert({
      organization_id: orgId,
      job_id: params.job_id,
      assessed_by: user.id,
      assessed_hazards: params.hazards,
      required_ppe: params.ppe,
      site_conditions_assessed: params.site_conditions,
      initial_risk_scores: params.hazards.map((h) => ({
        hazard: h.hazard_type,
        score: h.initial_risk_score,
      })),
      status: "COMPLETED",
      ai_generated: true,
      source_scan_id: scanId,
    });

  if (swmsErr) return { error: swmsErr.message };

  // Update scan status
  await (supabase as SupabaseClient)
    .from("vision_hazard_scans")
    .update({
      status: "COMMITTED",
      reviewed_by: user.id,
      committed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", scanId);

  revalidatePath("/dashboard/ops/safety");
  return { error: null };
}

/* ── Debrief Dashboard Stats ─────────────────────────── */

export async function getAmbientStats(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const [pending, committed, failed, total] = await Promise.all([
    (supabase as SupabaseClient).from("audio_debriefs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("status", "PENDING_REVIEW"),
    (supabase as SupabaseClient).from("audio_debriefs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("status", "COMMITTED"),
    (supabase as SupabaseClient).from("audio_debriefs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("status", "FAILED"),
    (supabase as SupabaseClient).from("audio_debriefs").select("id", { count: "exact" }).eq("organization_id", orgId),
  ]);

  return {
    data: {
      pending_review: pending.data?.length ?? 0,
      committed: committed.data?.length ?? 0,
      failed: failed.data?.length ?? 0,
      total: total.data?.length ?? 0,
    },
    error: null,
  };
}
