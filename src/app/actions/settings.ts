/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Organization Settings ─────────────────────────────── */

/**
 * Get full organization record including settings JSONB
 */
export async function getOrganization(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("organizations")
      .update({ ...updates, updated_at: new Date().toISOString() })
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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Get current settings first
    const { data: org, error: fetchError } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const currentSettings = org?.settings || {};
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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Get current preferences first
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const current = profile?.preferences || {};
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
    const supabase = await createServerSupabaseClient() as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const current = profile?.notification_preferences || {};
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
