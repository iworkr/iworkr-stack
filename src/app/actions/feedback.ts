/**
 * @module Feedback Server Actions
 * @status COMPLETE
 * @description Project Halcyon — feedback dashboard for viewing, managing, and routing internal feedback with sentiment analysis
 * @exports fetchFeedbackAction, updateFeedbackStatusAction, routeFeedbackAction, fetchFeedbackStatsAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================================
// Project Halcyon — Server Actions for Feedback Dashboard
// ============================================================================
// Admin-facing actions to view, manage, and route internal feedback
// absorbed by the Halcyon Sentiment Sieve.
// ============================================================================

/* ── Helpers ──────────────────────────────────────────── */

async function assertOrgAdmin(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Only owners and admins can manage feedback");
  }

  return { supabase, user };
}

/* ── Get Internal Feedback Logs ───────────────────────── */

export async function getInternalFeedback(
  orgId: string,
  options?: {
    status?: "unread" | "ticket_created" | "resolved" | "escalated";
    limit?: number;
    offset?: number;
  }
) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    let query = (supabase as any)
      .from("internal_feedback_logs")
      .select(
        `
        *,
        profiles:user_id (full_name, email, avatar_url)
      `
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(
        options?.offset || 0,
        (options?.offset || 0) + (options?.limit || 50) - 1
      );

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error, count } = await query;

    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: count || data?.length || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

/* ── Update Feedback Status ───────────────────────────── */

export async function updateFeedbackStatus(
  orgId: string,
  feedbackId: string,
  status: "unread" | "ticket_created" | "resolved" | "escalated",
  ticketUrl?: string
) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    const updates: Record<string, any> = { status };
    if (ticketUrl) updates.ticket_url = ticketUrl;

    const { data, error } = await (supabase as any)
      .from("internal_feedback_logs")
      .update(updates)
      .eq("id", feedbackId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get Feedback Analytics ───────────────────────────── */

export async function getFeedbackAnalytics(orgId: string) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    // Count by status
    const { data: statusCounts, error: countErr } = await (supabase as any)
      .from("internal_feedback_logs")
      .select("status")
      .eq("organization_id", orgId);

    if (countErr)
      return { data: null, error: countErr.message };

    const analytics = {
      total: statusCounts?.length || 0,
      unread: statusCounts?.filter((r: any) => r.status === "unread").length || 0,
      ticket_created:
        statusCounts?.filter((r: any) => r.status === "ticket_created").length || 0,
      resolved:
        statusCounts?.filter((r: any) => r.status === "resolved").length || 0,
      escalated:
        statusCounts?.filter((r: any) => r.status === "escalated").length || 0,
    };

    return { data: analytics, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get User Feedback Metrics (Admin view) ───────────── */

export async function getUserFeedbackMetrics(orgId: string, userId: string) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    const { data, error } = await (supabase as any)
      .from("user_feedback_metrics")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Hard Lock / Unlock User ──────────────────────────── */

export async function toggleFeedbackLock(
  orgId: string,
  userId: string,
  lock: boolean,
  reason?: string,
  durationDays?: number
) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    const updates: Record<string, any> = {
      is_hard_locked: lock,
      updated_at: new Date().toISOString(),
    };

    if (lock) {
      updates.lock_reason = reason || "manual_admin_lock";
      updates.locked_until = new Date(
        Date.now() + (durationDays || 30) * 24 * 60 * 60 * 1000
      ).toISOString();
    } else {
      updates.lock_reason = null;
      updates.locked_until = null;
    }

    const { data, error } = await (supabase as any)
      .from("user_feedback_metrics")
      .update(updates)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
