"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const UpsertAgentConfigSchema = z.object({
  enabled: z.boolean().optional(),
  voice_id: z.string().max(100).optional(),
  business_hours_mode: z.enum(["after_hours", "24_7", "custom"]).optional(),
  business_hours_start: z.string().max(10).optional(),
  business_hours_end: z.string().max(10).optional(),
  knowledge_base: z.string().max(50000).optional(),
  greeting_message: z.string().max(1000).optional(),
  escalation_number: z.string().max(30).optional().nullable(),
  transfer_enabled: z.boolean().optional(),
  booking_enabled: z.boolean().optional(),
  max_call_duration_seconds: z.number().min(30).max(3600).optional(),
});

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
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: null, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("ai_agent_config")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  return { data: data as AIAgentConfig | null };
}

export async function upsertAgentConfig(
  orgId: string,
  config: Partial<Omit<AIAgentConfig, "id" | "organization_id">>
): Promise<{ error?: string }> {
  // Validate input
  const parsed = UpsertAgentConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { error: JSON.stringify(parsed.error.flatten().fieldErrors) };
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

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
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("ai_agent_calls")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as AIAgentCall[] };
}

export async function getCallTranscript(callId: string): Promise<{ transcript: string | null; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { transcript: null, error: "Unauthorized" };

  const { data: call } = await supabase
    .from("ai_agent_calls")
    .select("organization_id")
    .eq("id", callId)
    .maybeSingle();
  if (!call) return { transcript: null, error: "Call not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", call.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { transcript: null, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("ai_agent_calls")
    .select("transcript")
    .eq("id", callId)
    .maybeSingle();

  if (error) return { transcript: null, error: error.message };
  return { transcript: data?.transcript ?? null };
}
