/**
 * @module PanopticonChat Server Actions
 * @status COMPLETE
 * @description AI analytics chat — natural language data queries, conversation history, and insight generation
 * @exports sendChatQueryAction, fetchChatHistoryAction, clearChatHistoryAction, generateInsightAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
   CHAT SESSIONS
   ══════════════════════════════════════════════════════ */

export async function createChatSession(orgId: string, title?: string) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("panopticon_chat_sessions")
    .insert({
      organization_id: orgId,
      user_id: user.id,
      title: title || "New conversation",
    })
    .select("id")
    .single();

  return {
    data: data as { id: string } | null,
    error: dbErr?.message ?? null,
  };
}

export async function getChatSessions(orgId: string) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: [], error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("panopticon_chat_sessions")
    .select("*")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  return {
    data: (data ?? []) as unknown as {
      id: string;
      title: string;
      message_count: number;
      updated_at: string;
    }[],
    error: dbErr?.message ?? null,
  };
}

export async function getChatMessages(orgId: string, sessionId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("panopticon_chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return {
    data: (data ?? []) as unknown as Record<string, unknown>[],
    error: dbErr?.message ?? null,
  };
}

export async function saveChatMessage(
  orgId: string,
  sessionId: string,
  params: {
    role: string;
    content: string;
  }
) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("panopticon_chat_messages")
    .insert({
      session_id: sessionId,
      role: params.role,
      content: params.content,
    })
    .select("id")
    .single();

  return {
    data: data as { id: string } | null,
    error: dbErr?.message ?? null,
  };
}

export async function updateSessionTitle(
  orgId: string,
  sessionId: string,
  title: string
) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  await (supabase as SupabaseClient)
    .from("panopticon_chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  revalidatePath("/dashboard/analytics/chat");
  return { error: null };
}

export async function deleteChatSession(orgId: string, sessionId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  await (supabase as SupabaseClient)
    .from("panopticon_chat_sessions")
    .delete()
    .eq("id", sessionId);

  revalidatePath("/dashboard/analytics/chat");
  return { error: null };
}

/* ══════════════════════════════════════════════════════
   ANALYTICS METADATA
   ══════════════════════════════════════════════════════ */

export async function getLastRefreshTimestamp(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data } = await (supabase as SupabaseClient).rpc(
    "get_analytics_last_refresh"
  );

  return { data: data as string | null, error: null };
}

