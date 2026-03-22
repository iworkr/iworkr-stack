/**
 * @module Communications Server Actions
 * @status COMPLETE
 * @description Communication preferences — SMS/email notification settings for roster, shifts, announcements, and payslips
 * @exports fetchCommunicationSettings, updateCommunicationSettings
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

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

    // Enforce invariants
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
