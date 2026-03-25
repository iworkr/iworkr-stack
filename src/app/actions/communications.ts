/**
 * @module Communications Server Actions
 * @status COMPLETE
 * @description Project Hermes-Matrix — Communication rules CRUD (per-event
 *   channel toggles + SMS templates), workspace-level settings, and dispatch
 *   log querying for the Command Center UI.
 * @exports getWorkspaceCommunicationSettings, updateWorkspaceCommunicationSettings,
 *   getCommunicationRules, updateCommunicationRule, getCommunicationLogs
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Legacy flat settings (workspace_communication_settings) ────────
export interface CommunicationSettings {
  sms_enabled: boolean;
  sms_roster_published: boolean;
  sms_shift_modified_urgent: boolean;
  sms_shift_modified_standard: boolean;
  sms_announcements: boolean;
  sms_payslips: boolean;
  email_roster_published: boolean;
  email_shift_modified: boolean;
  email_announcements: boolean;
  email_payslips: boolean;
  push_always_on: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_override_urgent: boolean;
  twilio_sender_id: string;
}

export const DEFAULT_SETTINGS: CommunicationSettings = {
  sms_enabled: false,
  sms_roster_published: false,
  sms_shift_modified_urgent: true,
  sms_shift_modified_standard: false,
  sms_announcements: false,
  sms_payslips: false,
  email_roster_published: true,
  email_shift_modified: true,
  email_announcements: true,
  email_payslips: true,
  push_always_on: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "06:00",
  quiet_hours_override_urgent: true,
  twilio_sender_id: "iWorkr",
};

export async function getWorkspaceCommunicationSettings(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("workspace_communication_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) return { data: { ...DEFAULT_SETTINGS }, error: null };
    return {
      data: data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS },
      error: null,
    };
  } catch (err: any) {
    return { data: { ...DEFAULT_SETTINGS }, error: err.message };
  }
}

export async function updateWorkspaceCommunicationSettings(
  orgId: string,
  settings: Partial<CommunicationSettings>
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (
      !membership ||
      !["owner", "admin", "manager"].includes(membership.role)
    ) {
      return { error: "Insufficient permissions" };
    }

    const safe = { ...settings };
    (safe as any).push_always_on = true;
    (safe as any).sms_payslips = false;
    if (safe.sms_enabled === false) {
      safe.sms_roster_published = false;
      safe.sms_shift_modified_urgent = false;
      safe.sms_shift_modified_standard = false;
      safe.sms_announcements = false;
    }

    const { error } = await (supabase as any)
      .from("workspace_communication_settings")
      .upsert(
        {
          organization_id: orgId,
          ...safe,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ─── Hermes-Matrix: Per-Event Communication Rules ───────────────────

export type NotificationEventType =
  | "ROSTER_PUBLISHED"
  | "SHIFT_UPDATED"
  | "SHIFT_CANCELLED"
  | "NEW_JOB_ASSIGNED"
  | "OUTRIDER_EN_ROUTE"
  | "JOB_COMPLETED"
  | "INVOICE_OVERDUE"
  | "S8_MEDICATION_MISSED";

export interface CommunicationRule {
  id: string;
  workspace_id: string;
  event_type: NotificationEventType;
  enable_sms: boolean;
  enable_email: boolean;
  enable_push: boolean;
  sms_template: string;
  email_subject_template: string | null;
  created_at: string;
  updated_at: string;
}

export interface DispatchLogEntry {
  id: string;
  workspace_id: string;
  event_type: string | null;
  channel: string;
  status: string;
  to_address: string | null;
  recipient_phone: string | null;
  body_preview: string | null;
  subject: string | null;
  provider_message_id: string | null;
  segments: number | null;
  cost_cents: number | null;
  error_message: string | null;
  client_id: string | null;
  job_id: string | null;
  worker_id: string | null;
  created_at: string;
}

export const EVENT_TYPE_META: Record<
  NotificationEventType,
  {
    label: string;
    description: string;
    sector: "schedule" | "dispatch" | "billing" | "compliance";
    templateVars: string[];
  }
> = {
  ROSTER_PUBLISHED: {
    label: "Roster Published",
    description:
      "Notify team members when a new roster is published for their schedule period.",
    sector: "schedule",
    templateVars: ["worker_name", "start_date", "end_date", "shift_count"],
  },
  SHIFT_UPDATED: {
    label: "Shift Updated (Urgent)",
    description:
      "Immediate alert when a shift is changed within the next 24 hours.",
    sector: "schedule",
    templateVars: ["worker_name", "client_name", "date"],
  },
  SHIFT_CANCELLED: {
    label: "Shift Cancelled",
    description:
      "Alert when a shift is cancelled, giving the worker and client notice.",
    sector: "schedule",
    templateVars: ["worker_name", "client_name", "date"],
  },
  NEW_JOB_ASSIGNED: {
    label: "New Job Assigned",
    description:
      "Notify a field worker when a new job is dispatched to them.",
    sector: "dispatch",
    templateVars: ["worker_name", "job_title", "suburb"],
  },
  OUTRIDER_EN_ROUTE: {
    label: "Worker En Route",
    description:
      "Customer receives live tracking link when worker taps 'Start Travel'.",
    sector: "dispatch",
    templateVars: ["client_name", "worker_name", "tracking_link", "eta"],
  },
  JOB_COMPLETED: {
    label: "Job Completed",
    description:
      "Notify client when a job has been marked as completed.",
    sector: "dispatch",
    templateVars: ["client_name", "job_title", "org_name"],
  },
  INVOICE_OVERDUE: {
    label: "Invoice Overdue",
    description:
      "Remind client when an invoice passes its due date.",
    sector: "billing",
    templateVars: ["client_name", "invoice_number", "amount", "payment_link"],
  },
  S8_MEDICATION_MISSED: {
    label: "S8 Medication Missed",
    description:
      "Critical compliance alert when a Schedule 8 medication is not signed off.",
    sector: "compliance",
    templateVars: ["client_name", "time"],
  },
};

async function checkAdminPermission(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase: null, error: "Unauthorized" };

  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (
    !membership ||
    !["owner", "admin", "manager"].includes(membership.role)
  ) {
    return { supabase: null, error: "Insufficient permissions" };
  }

  return { supabase, error: null };
}

export async function getCommunicationRules(
  orgId: string
): Promise<{ data: CommunicationRule[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("workspace_communication_rules")
      .select("*")
      .eq("workspace_id", orgId)
      .order("event_type");

    if (error) return { data: null, error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateCommunicationRule(
  orgId: string,
  eventType: NotificationEventType,
  updates: {
    enable_sms?: boolean;
    enable_email?: boolean;
    enable_push?: boolean;
    sms_template?: string;
    email_subject_template?: string;
  }
): Promise<{ data: CommunicationRule | null; error: string | null }> {
  try {
    const { supabase, error: authError } = await checkAdminPermission(orgId);
    if (authError || !supabase) return { data: null, error: authError || "Auth failed" };

    const { data, error } = await (supabase as any).rpc(
      "upsert_communication_rule",
      {
        p_workspace_id: orgId,
        p_event_type: eventType,
        p_enable_sms: updates.enable_sms ?? null,
        p_enable_email: updates.enable_email ?? null,
        p_enable_push: updates.enable_push ?? null,
        p_sms_template: updates.sms_template ?? null,
        p_email_subject_template: updates.email_subject_template ?? null,
      }
    );

    if (error) return { data: null, error: error.message };
    return { data: data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getCommunicationLogs(
  orgId: string,
  options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    channel?: string;
    status?: string;
  }
): Promise<{ data: DispatchLogEntry[] | null; total: number; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, total: 0, error: "Unauthorized" };

    let query = (supabase as any)
      .from("communication_logs")
      .select("*", { count: "exact" })
      .eq("workspace_id", orgId)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false });

    if (options?.eventType) query = query.eq("event_type", options.eventType);
    if (options?.channel) query = query.eq("channel", options.channel);
    if (options?.status) query = query.eq("status", options.status);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) return { data: null, total: 0, error: error.message };
    return { data: data || [], total: count || 0, error: null };
  } catch (err: any) {
    return { data: null, total: 0, error: err.message };
  }
}
