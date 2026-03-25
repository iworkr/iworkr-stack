/**
 * @module Siren-Voice Server Actions
 * @status COMPLETE
 * @description Project Siren-Voice — CTI telephony server actions for AI receptionist,
 *   call management, AI call actions audit, live transcription, and phone config.
 * @exports getAiCallActions, getCallHistory, triggerTranscription, updatePhoneConfig,
 *          getCallTranscript, getAiCallStats
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface AiCallAction {
  id: string;
  workspace_id: string;
  call_record_id: string | null;
  log_id: string | null;
  client_id: string | null;
  action_type: string;
  action_payload: Record<string, any>;
  action_result: Record<string, any>;
  success: boolean;
  caller_phone: string | null;
  caller_intent: string | null;
  ai_confidence: number | null;
  ai_model_used: string | null;
  created_at: string;
  // Joined fields
  client_name?: string;
}

export interface CallHistoryEntry {
  id: string;
  log_id: string;
  twilio_call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  ai_transcript: string | null;
  ai_summary: string | null;
  ai_handled: boolean;
  transcript_status: string | null;
  sentiment_score: number | null;
  caller_intent: string | null;
  created_at: string;
  // From communication_logs join
  direction?: string;
  status?: string;
  client_name?: string;
  client_id?: string;
  body_preview?: string;
}

export interface AiCallStats {
  total_calls: number;
  ai_handled: number;
  human_handled: number;
  missed: number;
  voicemails: number;
  avg_duration: number;
  total_ai_actions: number;
  reschedules: number;
  leads_created: number;
  messages_saved: number;
  escalations: number;
}

export interface PhoneConfigUpdate {
  forwarding_number?: string;
  routing_strategy?: string;
  ai_prompt_context?: string;
  ai_voice_id?: string;
  ai_timeout_seconds?: number;
  business_name?: string;
  business_hours?: Record<string, any>;
  escalation_number?: string;
  friendly_name?: string;
}

/* ── AI Call Actions ────────────────────────────────────────────────────── */

export async function getAiCallActions(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    actionType?: string;
  }
): Promise<{ data: AiCallAction[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    let query = (supabase as any)
      .from("ai_call_actions")
      .select("*, clients:client_id(name)")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);
    }

    if (options?.actionType) {
      query = query.eq("action_type", options.actionType);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };

    const enriched = (data || []).map((row: any) => ({
      ...row,
      client_name: row.clients?.name || null,
      clients: undefined,
    }));

    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Call History (Enhanced with AI fields) ──────────────────────────────── */

export async function getCallHistory(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    aiOnly?: boolean;
  }
): Promise<{ data: CallHistoryEntry[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const serviceClient = createServiceClient();

    // Use a raw query approach via communication_logs + voip_call_records join
    let query = (serviceClient as any)
      .from("communication_logs")
      .select(`
        id, workspace_id, direction, status, from_address, to_address,
        body_preview, duration_seconds, client_id, created_at,
        clients:client_id(name),
        voip_call_records!voip_call_records_log_id_fkey(
          id, twilio_call_sid, from_number, to_number,
          duration_seconds, recording_url, ai_transcript, ai_summary,
          ai_handled, transcript_status, sentiment_score, caller_intent,
          created_at
        )
      `)
      .eq("workspace_id", orgId)
      .eq("channel", "voice_call")
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 50);

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);
    }

    if (options?.aiOnly) {
      query = query.eq("status", "ai_handled");
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };

    const entries: CallHistoryEntry[] = (data || []).map((log: any) => {
      const voip = log.voip_call_records?.[0] || {};
      return {
        id: voip.id || log.id,
        log_id: log.id,
        twilio_call_sid: voip.twilio_call_sid || null,
        from_number: voip.from_number || log.from_address,
        to_number: voip.to_number || log.to_address,
        duration_seconds: voip.duration_seconds || log.duration_seconds || 0,
        recording_url: voip.recording_url || null,
        ai_transcript: voip.ai_transcript || null,
        ai_summary: voip.ai_summary || null,
        ai_handled: voip.ai_handled || false,
        transcript_status: voip.transcript_status || null,
        sentiment_score: voip.sentiment_score || null,
        caller_intent: voip.caller_intent || null,
        created_at: log.created_at,
        direction: log.direction,
        status: log.status,
        client_name: log.clients?.name || null,
        client_id: log.client_id,
        body_preview: log.body_preview,
      };
    });

    return { data: entries, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get Call Transcript ────────────────────────────────────────────────── */

export async function getCallTranscript(
  callSid: string
): Promise<{
  data: {
    transcript_jsonb: Record<string, any> | null;
    ai_summary: string | null;
    ai_handled: boolean;
    ai_actions_taken: Record<string, any>[];
  } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("voip_call_records")
      .select("transcript_jsonb, ai_summary, ai_handled, ai_actions_taken")
      .eq("twilio_call_sid", callSid)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data || null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Trigger Transcription ──────────────────────────────────────────────── */

export async function triggerTranscription(
  callSid: string,
  recordingUrl?: string
): Promise<{ data: { triggered: boolean } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${supabaseUrl}/functions/v1/siren-voice-transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        call_sid: callSid,
        recording_url: recordingUrl || "",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { data: null, error: `Transcription failed: ${errText}` };
    }

    revalidatePath("/dashboard/comms");
    return { data: { triggered: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Update Phone Configuration ─────────────────────────────────────────── */

export async function updatePhoneConfig(
  phoneNumberId: string,
  updates: PhoneConfigUpdate
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.forwarding_number !== undefined) updatePayload.forwarding_number = updates.forwarding_number;
    if (updates.routing_strategy !== undefined) updatePayload.routing_strategy = updates.routing_strategy;
    if (updates.ai_prompt_context !== undefined) updatePayload.ai_prompt_context = updates.ai_prompt_context;
    if (updates.ai_voice_id !== undefined) updatePayload.ai_voice_id = updates.ai_voice_id;
    if (updates.ai_timeout_seconds !== undefined) updatePayload.ai_timeout_seconds = updates.ai_timeout_seconds;
    if (updates.business_name !== undefined) updatePayload.business_name = updates.business_name;
    if (updates.business_hours !== undefined) updatePayload.business_hours = updates.business_hours;
    if (updates.escalation_number !== undefined) updatePayload.escalation_number = updates.escalation_number;
    if (updates.friendly_name !== undefined) updatePayload.friendly_name = updates.friendly_name;

    const { error } = await (supabase as any)
      .from("workspace_phone_numbers")
      .update(updatePayload)
      .eq("id", phoneNumberId);

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/comms");
    revalidatePath("/settings/comms");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── AI Call Stats ──────────────────────────────────────────────────────── */

export async function getAiCallStats(
  orgId: string
): Promise<{ data: AiCallStats | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const serviceClient = createServiceClient();

    // Call stats from communication_logs
    const { data: callStats } = await (serviceClient as any)
      .from("communication_logs")
      .select("status, duration_seconds")
      .eq("workspace_id", orgId)
      .eq("channel", "voice_call");

    const calls = callStats || [];
    const totalCalls = calls.length;
    const aiHandled = calls.filter((c: any) => c.status === "ai_handled").length;
    const humanHandled = calls.filter((c: any) => c.status === "completed").length;
    const missed = calls.filter((c: any) => c.status === "missed").length;
    const voicemails = calls.filter((c: any) => c.status === "voicemail").length;
    const totalDuration = calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    // AI action stats
    const { data: actionStats } = await (serviceClient as any)
      .from("ai_call_actions")
      .select("action_type")
      .eq("workspace_id", orgId);

    const actions = actionStats || [];
    const reschedules = actions.filter((a: any) => a.action_type === "reschedule_job").length;
    const leadsCreated = actions.filter((a: any) => a.action_type === "create_lead").length;
    const messagesSaved = actions.filter((a: any) => a.action_type === "save_message").length;
    const escalations = actions.filter((a: any) => a.action_type === "trigger_escalation").length;

    return {
      data: {
        total_calls: totalCalls,
        ai_handled: aiHandled,
        human_handled: humanHandled,
        missed,
        voicemails,
        avg_duration: avgDuration,
        total_ai_actions: actions.length,
        reschedules,
        leads_created: leadsCreated,
        messages_saved: messagesSaved,
        escalations,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
