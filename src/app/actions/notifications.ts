/**
 * @module Notifications Server Actions
 * @status COMPLETE
 * @description Push & in-app notifications — create, fetch, mark read, dismiss, device registration, and preference management
 * @exports createNotification, fetchNotifications, markAsRead, dismissNotification, registerDevice
 * @lastAudit 2026-03-22
 */
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
  "job_cancelled", "job_rescheduled", "message_received", "compliance_warning",
  "nudge_clock_in", "nudge_clock_out", "announcement",
  "shift_assigned", "shift_rescheduled", "chat_reply", "chat_mention",
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
  type: string;
  title: string;
  body: string | null;
  sender_id: string | null;
  sender_name: string | null;
  context: string | null;
  read: boolean;
  read_at: string | null;
  archived: boolean;
  snoozed_until: string | null;
  related_job_id: string | null;
  related_client_id: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  action_url: string | null;
  action_link: string | null;
  priority: "low" | "normal" | "high" | "urgent" | null;
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
        type: params.type as any,
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
      } as any)
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

/* ── Notification Preferences ────────────────────────── */

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  in_app_enabled: boolean;
  quiet_hours_start: string | null; // e.g. "22:00"
  quiet_hours_end: string | null;   // e.g. "07:00"
  muted_types: string[];            // notification types to mute
}

const UpdatePreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().max(10).nullable().optional(),
  quiet_hours_end: z.string().max(10).nullable().optional(),
  muted_types: z.array(z.string()).optional(),
});

export async function getNotificationPreferences() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await (supabase as any)
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      logger.error("Failed to fetch notification preferences", "notifications", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    // Return defaults if no row exists yet
    if (!data) {
      return {
        data: {
          email_enabled: true,
          push_enabled: true,
          sms_enabled: false,
          in_app_enabled: true,
          quiet_hours_start: null,
          quiet_hours_end: null,
          muted_types: [],
        } as NotificationPreferences,
        error: null,
      };
    }

    return { data: data as NotificationPreferences, error: null };
  } catch (error: any) {
    logger.error("Notification preferences error", "notifications", error);
    return { data: null, error: error.message || "Failed to fetch preferences" };
  }
}

export async function updateNotificationPreferences(prefs: Partial<NotificationPreferences>) {
  try {
    const parsed = UpdatePreferencesSchema.safeParse(prefs);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await (supabase as any)
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: user.id,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) {
      logger.error("Failed to update notification preferences", "notifications", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: data as NotificationPreferences, error: null };
  } catch (error: any) {
    logger.error("Update preferences error", "notifications", error);
    return { data: null, error: error.message || "Failed to update preferences" };
  }
}

/* ── Device Registration ─────────────────────────────── */

const RegisterDeviceSchema = z.object({
  fcm_token: z.string().min(1, "FCM token is required"),
  device_type: z.enum(["web", "ios", "android"]),
  app_version: z.string().max(50).optional(),
  device_name: z.string().max(200).optional(),
});

export async function registerDevice(params: {
  fcm_token: string;
  device_type: "web" | "ios" | "android";
  app_version?: string;
  device_name?: string;
}) {
  try {
    const parsed = RegisterDeviceSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await (supabase as any)
      .from("user_devices")
      .upsert(
        {
          user_id: user.id,
          fcm_token: parsed.data.fcm_token,
          device_type: parsed.data.device_type,
          app_version: parsed.data.app_version || null,
          device_name: parsed.data.device_name || null,
          is_active: true,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "fcm_token" },
      )
      .select()
      .single();

    if (error) {
      logger.error("Device registration error", "notifications", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error("Register device error", "notifications", error);
    return { data: null, error: error.message || "Failed to register device" };
  }
}

/* ── Broadcast Announcement ──────────────────────────── */

export async function broadcastAnnouncement(orgId: string, title: string, body: string) {
  try {
    if (!orgId || !title) {
      return { data: null, error: "Organization ID and title are required" };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    // Verify org membership + admin role
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) return { data: null, error: "Unauthorized" };
    if (!["owner", "admin"].includes(membership.role)) {
      return { data: null, error: "Only admins can broadcast announcements" };
    }

    // Call the broadcast_announcement RPC
    const { data, error } = await (supabase as any).rpc("broadcast_announcement", {
      p_organization_id: orgId,
      p_title: title,
      p_body: body,
    });

    if (error) {
      logger.error("Broadcast announcement error", "notifications", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    revalidatePath(INBOX_PATH);
    return { data: data || { success: true }, error: null };
  } catch (error: any) {
    logger.error("Broadcast error", "notifications", error);
    return { data: null, error: error.message || "Failed to broadcast announcement" };
  }
}
