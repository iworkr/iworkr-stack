/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────────── */

const notificationTypeSchema = z.enum([
  "job_assigned", "quote_approved", "mention", "system",
  "review", "invoice_paid", "schedule_conflict", "form_signed", "team_invite",
]);

const CreateNotificationSchema = z.object({
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: notificationTypeSchema,
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().max(2000).optional().nullable(),
  sender_id: z.string().uuid().optional().nullable(),
  sender_name: z.string().max(200).optional().nullable(),
  context: z.string().max(500).optional().nullable(),
  related_job_id: z.string().uuid().optional().nullable(),
  related_client_id: z.string().uuid().optional().nullable(),
  related_entity_type: z.string().max(50).optional().nullable(),
  related_entity_id: z.string().uuid().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const SendReplySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(5000),
});

/* ── Types ───────────────────────────────────────────── */

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: "job_assigned" | "quote_approved" | "mention" | "system" | "review" | "invoice_paid" | "schedule_conflict" | "form_signed" | "team_invite";
  title: string;
  body: string | null;
  sender_id: string | null;
  sender_name: string | null;
  context: string | null;
  read: boolean;
  archived: boolean;
  snoozed_until: string | null;
  related_job_id: string | null;
  related_client_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CreateNotificationParams {
  organization_id: string;
  user_id: string;
  type: Notification["type"];
  title: string;
  body?: string | null;
  sender_id?: string | null;
  sender_name?: string | null;
  context?: string | null;
  related_job_id?: string | null;
  related_client_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  metadata?: Record<string, any> | null;
}

const INBOX_PATH = "/dashboard/inbox";

/* ── Get notifications ───────────────────────────────── */

export async function getNotifications() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    // Fetch active notifications (not archived, not currently snoozed)
    const { data: active, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .is("snoozed_until", null)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch notifications", "inbox", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    // Also fetch snoozed notifications that are past their snooze time
    const { data: unsnoozed } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .not("snoozed_until", "is", null)
      .lte("snoozed_until", new Date().toISOString())
      .order("created_at", { ascending: false });

    const all = [...(active || []), ...(unsnoozed || [])];
    all.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { data: all, error: null };
  } catch (error: any) {
    logger.error("Notifications fetch error", "inbox", error);
    return { data: null, error: error.message || "Failed to fetch notifications" };
  }
}

/* ── Get snoozed notifications ───────────────────────── */

export async function getSnoozedNotifications() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("archived", false)
      .not("snoozed_until", "is", null)
      .gt("snoozed_until", new Date().toISOString())
      .order("snoozed_until", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch snoozed notifications" };
  }
}

/* ── Mark single as read ─────────────────────────────── */

export async function markRead(notificationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    logger.error("Mark read error", "inbox", error);
    return { data: null, error: error.message || "Failed to mark as read" };
  }
}

/* ── Bulk mark as read ───────────────────────────────── */

export async function markAllRead() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data: { success: true }, error: null };
  } catch (error: any) {
    logger.error("Mark all read error", "inbox", error);
    return { data: null, error: error.message || "Failed to mark all as read" };
  }
}

/* ── Archive ─────────────────────────────────────────── */

export async function archiveNotification(notificationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .update({ archived: true, read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    logger.error("Archive error", "inbox", error);
    return { data: null, error: error.message || "Failed to archive notification" };
  }
}

/* ── Unarchive ───────────────────────────────────────── */

export async function unarchiveNotification(notificationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .update({ archived: false })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to unarchive" };
  }
}

/* ── Snooze ──────────────────────────────────────────── */

export async function snoozeNotification(notificationId: string, until: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .update({ snoozed_until: until })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    logger.error("Snooze error", "inbox", error);
    return { data: null, error: error.message || "Failed to snooze notification" };
  }
}

/* ── Unsnooze ────────────────────────────────────────── */

export async function unsnoozeNotification(notificationId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notifications")
      .update({ snoozed_until: null })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to unsnooze" };
  }
}

/* ── Create notification ─────────────────────────────── */

export async function createNotification(params: CreateNotificationParams) {
  try {
    // Validate input
    const parsed = CreateNotificationSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        organization_id: params.organization_id,
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        body: params.body || null,
        sender_id: params.sender_id || null,
        sender_name: params.sender_name || null,
        context: params.context || null,
        related_job_id: params.related_job_id || null,
        related_client_id: params.related_client_id || null,
        related_entity_type: params.related_entity_type || null,
        related_entity_id: params.related_entity_id || null,
        metadata: params.metadata || null,
        read: false,
        archived: false,
        snoozed_until: null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    logger.error("Create notification error", "inbox", error);
    return { data: null, error: error.message || "Failed to create notification" };
  }
}

/* ── Reply to notification ────────────────────────────── */

export async function sendReplyAction(notificationId: string, body: string) {
  try {
    // Validate input
    const parsed = SendReplySchema.safeParse({ body });
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase
      .from("notification_replies")
      .insert({
        notification_id: notificationId,
        user_id: user.id,
        body: body.trim(),
      })
      .select()
      .single();

    if (error) {
      logger.error("Reply insert error", "inbox", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    revalidatePath(INBOX_PATH);
    return { data, error: null };
  } catch (error: any) {
    logger.error("Send reply error", "inbox", error);
    return { data: null, error: error.message || "Failed to send reply" };
  }
}

/* ── Get unread count ────────────────────────────────── */

export async function getUnreadCount() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .eq("archived", false)
      .is("snoozed_until", null);

    if (error) return { data: null, error: error.message };
    return { data: count || 0, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to get unread count" };
  }
}
