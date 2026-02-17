"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ─────────────────────────────────────────── */

export interface AIAgentConfig {
  id: string;
  organization_id: string;
  enabled: boolean;
  voice_id: string;
  business_hours_mode: "after_hours" | "24_7" | "custom";
  business_hours_start: string;
  business_hours_end: string;
  knowledge_base: string;
  greeting_message: string;
  escalation_number: string | null;
  transfer_enabled: boolean;
  booking_enabled: boolean;
  max_call_duration_seconds: number;
}

export interface AIAgentCall {
  id: string;
  caller_number: string | null;
  caller_name: string | null;
  duration_seconds: number;
  outcome: "booked" | "message" | "transferred" | "abandoned" | "voicemail";
  summary: string | null;
  transcript: string | null;
  recording_url: string | null;
  sentiment: "positive" | "neutral" | "negative";
  created_at: string;
}

/* ── Config CRUD ──────────────────────────────────── */

export async function getAgentConfig(orgId: string): Promise<{ data: AIAgentConfig | null; error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;
  const { data, error } = await supabase
    .from("ai_agent_config")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data };
}

export async function upsertAgentConfig(
  orgId: string,
  config: Partial<Omit<AIAgentConfig, "id" | "organization_id">>
): Promise<{ error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;

  // Check if config exists
  const { data: existing } = await supabase
    .from("ai_agent_config")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("ai_agent_config")
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("ai_agent_config")
      .insert({ organization_id: orgId, ...config });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard/ai-agent");
  return {};
}

/* ── Call Logs ────────────────────────────────────── */

export async function getAgentCalls(
  orgId: string,
  limit = 50
): Promise<{ data: AIAgentCall[]; error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;
  const { data, error } = await supabase
    .from("ai_agent_calls")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

export async function getCallTranscript(callId: string): Promise<{ transcript: string | null; error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;
  const { data, error } = await supabase
    .from("ai_agent_calls")
    .select("transcript")
    .eq("id", callId)
    .single();

  if (error) return { transcript: null, error: error.message };
  return { transcript: data?.transcript };
}
