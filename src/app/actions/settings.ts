/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────────── */

const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  logo_url: z.string().url().max(2000).optional().nullable(),
  trade: z.string().max(100).optional().nullable(),
  brand_color_hex: z.string().max(10).optional().nullable(),
}).strict();

const UpdateProfileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100).optional(),
  phone: z.string().max(30).optional().nullable(),
  avatar_url: z.string().url().max(2000).optional().nullable(),
  timezone: z.string().max(50).optional(),
  email: z.string().email("Invalid email").max(255).optional(),
}).strict();

const UpdatePreferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  home_view: z.string().max(50).optional(),
  display_names: z.enum(["full", "first", "initials"]).optional(),
  compact_mode: z.boolean().optional(),
  sidebar_collapsed: z.boolean().optional(),
}).passthrough();

const UpdateNotificationPreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  sms_enabled: z.boolean().optional(),
  job_assigned: z.boolean().optional(),
  quote_approved: z.boolean().optional(),
  invoice_paid: z.boolean().optional(),
  mention: z.boolean().optional(),
  schedule_conflict: z.boolean().optional(),
  form_signed: z.boolean().optional(),
}).passthrough();

/* ── Organization Settings ─────────────────────────────── */

/**
 * Get full organization record including settings JSONB
 */
export async function getOrganization(orgId: string) {
  try {
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
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch organization" };
  }
}

/**
 * Update organization top-level fields (name, slug, logo_url, trade)
 */
export async function updateOrganization(orgId: string, updates: Record<string, any>) {
  try {
    // Validate input
    const parsed = UpdateOrganizationSchema.safeParse(updates);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

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
      .from("organizations")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update organization" };
  }
}

/**
 * Update a specific key within the organization's settings JSONB
 * Uses jsonb_set to merge without overwriting entire object
 */
export async function updateOrgSettings(orgId: string, settingsUpdate: Record<string, any>) {
  try {
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

    // Get current settings first
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError.message };

    const currentSettings = (org?.settings || {}) as Record<string, unknown>;
    const mergedSettings = { ...currentSettings, ...settingsUpdate };

    const { data, error } = await supabase
      .from("organizations")
      .update({ settings: mergedSettings, updated_at: new Date().toISOString() })
      .eq("id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update org settings" };
  }
}

/* ── Profile Settings ──────────────────────────────────── */

/**
 * Get full profile record including preferences
 */
export async function getProfile(userId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };
    if (userId !== user.id) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch profile" };
  }
}

/**
 * Update profile top-level fields (full_name, phone, avatar_url, timezone)
 */
export async function updateProfile(userId: string, updates: Record<string, any>) {
  try {
    // Validate input
    const parsed = UpdateProfileSchema.safeParse(updates);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };
    if (userId !== user.id) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update profile" };
  }
}

/**
 * Update profile preferences JSONB (theme, home_view, display_names, etc.)
 */
export async function updateProfilePreferences(userId: string, prefsUpdate: Record<string, any>) {
  try {
    // Validate input
    const parsed = UpdatePreferencesSchema.safeParse(prefsUpdate);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };
    if (userId !== user.id) return { data: null, error: "Unauthorized" };

    // Get current preferences first
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError.message };

    const current = (profile?.preferences || {}) as Record<string, unknown>;
    const merged = { ...current, ...prefsUpdate };

    const { data, error } = await supabase
      .from("profiles")
      .update({ preferences: merged, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update preferences" };
  }
}

/**
 * Update notification preferences JSONB
 */
export async function updateNotificationPreferences(userId: string, prefsUpdate: Record<string, any>) {
  try {
    // Validate input
    const parsed = UpdateNotificationPreferencesSchema.safeParse(prefsUpdate);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };
    if (userId !== user.id) return { data: null, error: "Unauthorized" };

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError.message };

    const current = (profile?.notification_preferences || {}) as Record<string, unknown>;
    const merged = { ...current, ...prefsUpdate };

    const { data, error } = await supabase
      .from("profiles")
      .update({ notification_preferences: merged, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update notification preferences" };
  }
}

/* ── Export Workspace Data ──────────────────────────── */

function escapeCSVField(value: unknown): string {
  if (value == null) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCSVField(row[h])).join(","));
  }
  return lines.join("\n");
}

const EXPORTABLE_TABLES = ["clients", "jobs", "invoices"] as const;

export async function exportWorkspaceData(
  orgId: string,
  tables: string[]
): Promise<{ data: Record<string, string> | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data: membership } = await supabase
      .from("organization_members").select("user_id")
      .eq("organization_id", orgId).eq("user_id", user.id).maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const validTables = tables.filter((t) =>
      (EXPORTABLE_TABLES as readonly string[]).includes(t)
    );
    if (validTables.length === 0) return { data: null, error: "No valid tables selected" };

    const result: Record<string, string> = {};
    for (const table of validTables) {
      const { data: rows, error } = await (supabase as any)
        .from(table).select("*").eq("organization_id", orgId).limit(10000);
      if (error) { result[table] = `Error: ${error.message}`; }
      else { result[table] = rowsToCSV(rows || []); }
    }
    return { data: result, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Export failed" };
  }
}
