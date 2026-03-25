/**
 * @module Gateway Intake Server Actions
 * @status COMPLETE
 * @description Project Gateway-Intake: Widget CRUD, lead management, territory zones,
 *   presigned uploads, lead conversion to jobs/participants.
 * @exports createWidget, updateWidget, fetchWidgets, fetchLeads, updateLeadStatus,
 *   convertLeadToJob, fetchTerritoryZones, getPresignedUploadUrl
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────── */

export interface IntakeWidget {
  id: string;
  organization_id: string;
  name: string;
  sector: string;
  theme_color: string;
  logo_url: string | null;
  welcome_message: string;
  success_message: string;
  allowed_domains: string[];
  config_jsonb: Record<string, unknown>;
  is_active: boolean;
  embed_token: string;
  submissions_count: number;
  last_submission: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  widget_id: string | null;
  client_id: string | null;
  territory_id: string | null;
  status: "NEW" | "VIEWED" | "CONTACTED" | "CONVERTED" | "JUNK";
  urgency: "LOW" | "STANDARD" | "URGENT" | "EMERGENCY";
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_string: string | null;
  captured_data: Record<string, unknown>;
  media_urls: string[];
  source_domain: string | null;
  converted_job_id: string | null;
  converted_participant_id: string | null;
  created_at: string;
  updated_at: string;
  viewed_at: string | null;
  contacted_at: string | null;
  converted_at: string | null;
  widget_name?: string;
  territory_name?: string;
  client_name?: string;
}

export interface TerritoryZone {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  assigned_user_id: string | null;
  is_active: boolean;
  assigned_user_name?: string;
  created_at: string;
}

export interface LeadStats {
  total: number;
  new_count: number;
  viewed: number;
  contacted: number;
  converted: number;
  junk: number;
  emergency: number;
  today: number;
}

/* ── Helpers ──────────────────────────────────────────── */

async function getSupabase() {
  return (await createServerSupabaseClient()) as any;
}

/* ── Widget CRUD ──────────────────────────────────────── */

export async function createWidget(data: {
  organization_id: string;
  name: string;
  sector?: string;
  theme_color?: string;
  allowed_domains?: string[];
  config_jsonb?: Record<string, unknown>;
  welcome_message?: string;
  success_message?: string;
}): Promise<{ success: boolean; widget?: IntakeWidget; error?: string }> {
  try {
    const supabase = await getSupabase();
    const { data: widget, error } = await supabase
      .from("intake_widgets")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        sector: data.sector || "TRADES",
        theme_color: data.theme_color || "#10B981",
        allowed_domains: data.allowed_domains || [],
        config_jsonb: data.config_jsonb || {},
        welcome_message: data.welcome_message || "How can we help you today?",
        success_message: data.success_message || "Thank you! We will be in touch shortly.",
      })
      .select("*")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/settings/intake");
    return { success: true, widget };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to create widget" };
  }
}

export async function updateWidget(
  widgetId: string,
  updates: Partial<IntakeWidget>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("intake_widgets")
      .update(updates)
      .eq("id", widgetId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/settings/intake");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed to update widget" };
  }
}

export async function fetchWidgets(orgId: string): Promise<IntakeWidget[]> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("intake_widgets")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) { console.error("[gateway-intake] fetchWidgets:", error); return []; }
    return data || [];
  } catch {
    return [];
  }
}

export async function deleteWidget(widgetId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from("intake_widgets").delete().eq("id", widgetId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/settings/intake");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed" };
  }
}

/* ── Lead Management ──────────────────────────────────── */

export async function fetchLeads(
  orgId: string,
  options?: { status?: string; territory_id?: string; limit?: number; offset?: number },
): Promise<{ data: Lead[]; total: number }> {
  try {
    const supabase = await getSupabase();
    let query = supabase
      .from("leads")
      .select("*, intake_widgets(name), territory_zones(name), clients(name)", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status && options.status !== "all") query = query.eq("status", options.status);
    if (options?.territory_id) query = query.eq("territory_id", options.territory_id);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) { console.error("[gateway-intake] fetchLeads:", error); return { data: [], total: 0 }; }

    const leads = (data || []).map((row: any) => ({
      ...row,
      media_urls: row.media_urls || [],
      captured_data: row.captured_data || {},
      widget_name: row.intake_widgets?.name || null,
      territory_name: row.territory_zones?.name || null,
      client_name: row.clients?.name || null,
    }));

    return { data: leads, total: count || 0 };
  } catch {
    return { data: [], total: 0 };
  }
}

export async function fetchLeadById(leadId: string, orgId: string): Promise<Lead | null> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("leads")
      .select("*, intake_widgets(name), territory_zones(name), clients(name)")
      .eq("id", leadId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ...data,
      media_urls: data.media_urls || [],
      captured_data: data.captured_data || {},
      widget_name: data.intake_widgets?.name || null,
      territory_name: data.territory_zones?.name || null,
      client_name: data.clients?.name || null,
    };
  } catch {
    return null;
  }
}

export async function updateLeadStatus(
  leadId: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase();
    const updates: Record<string, unknown> = { status };

    if (status === "VIEWED") updates.viewed_at = new Date().toISOString();
    if (status === "CONTACTED") updates.contacted_at = new Date().toISOString();
    if (status === "CONVERTED") updates.converted_at = new Date().toISOString();

    const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
    if (error) return { success: false, error: error.message };
    revalidatePath("/dashboard/intake/queue");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed" };
  }
}

export async function convertLeadToJob(
  leadId: string,
  orgId: string,
): Promise<{ success: boolean; job_id?: string; error?: string }> {
  try {
    const supabase = await getSupabase();
    const lead = await fetchLeadById(leadId, orgId);
    if (!lead) return { success: false, error: "Lead not found" };

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        organization_id: orgId,
        client_id: lead.client_id,
        title: `Lead: ${lead.first_name} ${lead.last_name}`,
        description: lead.address_string || "",
        status: "pending",
        priority: lead.urgency === "EMERGENCY" ? "urgent" : "normal",
      })
      .select("id")
      .single();

    if (jobError) return { success: false, error: jobError.message };

    await supabase
      .from("leads")
      .update({ status: "CONVERTED", converted_job_id: job.id, converted_at: new Date().toISOString() })
      .eq("id", leadId);

    revalidatePath("/dashboard/intake/queue");
    return { success: true, job_id: job.id };
  } catch (e: any) {
    return { success: false, error: e?.message || "Conversion failed" };
  }
}

/* ── Lead Stats ───────────────────────────────────────── */

export async function fetchLeadStats(orgId: string): Promise<LeadStats> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from("leads")
      .select("status, urgency, created_at")
      .eq("organization_id", orgId);

    if (!data) return { total: 0, new_count: 0, viewed: 0, contacted: 0, converted: 0, junk: 0, emergency: 0, today: 0 };

    const today = new Date().toISOString().split("T")[0];
    return {
      total: data.length,
      new_count: data.filter((l: any) => l.status === "NEW").length,
      viewed: data.filter((l: any) => l.status === "VIEWED").length,
      contacted: data.filter((l: any) => l.status === "CONTACTED").length,
      converted: data.filter((l: any) => l.status === "CONVERTED").length,
      junk: data.filter((l: any) => l.status === "JUNK").length,
      emergency: data.filter((l: any) => l.urgency === "EMERGENCY").length,
      today: data.filter((l: any) => l.created_at?.startsWith(today)).length,
    };
  } catch {
    return { total: 0, new_count: 0, viewed: 0, contacted: 0, converted: 0, junk: 0, emergency: 0, today: 0 };
  }
}

/* ── Territory Zones ──────────────────────────────────── */

export async function fetchTerritoryZones(orgId: string): Promise<TerritoryZone[]> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("territory_zones")
      .select("id, organization_id, name, color, assigned_user_id, is_active, created_at, profiles!territory_zones_assigned_user_id_fkey(full_name)")
      .eq("organization_id", orgId)
      .order("name");

    if (error) { console.error("[gateway-intake] fetchTerritoryZones:", error); return []; }
    return (data || []).map((z: any) => ({
      ...z,
      assigned_user_name: z.profiles?.full_name || null,
    }));
  } catch {
    return [];
  }
}

export async function upsertTerritoryZone(
  orgId: string,
  zone: { id?: string; name: string; color?: string; assigned_user_id?: string | null; polygon_geometry?: string },
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await getSupabase();
    if (zone.id) {
      const { error } = await supabase.from("territory_zones").update({
        name: zone.name,
        color: zone.color || "#3B82F6",
        assigned_user_id: zone.assigned_user_id || null,
      }).eq("id", zone.id);
      if (error) return { success: false, error: error.message };
      return { success: true, id: zone.id };
    }

    const { data, error } = await supabase.from("territory_zones").insert({
      organization_id: orgId,
      name: zone.name,
      color: zone.color || "#3B82F6",
      assigned_user_id: zone.assigned_user_id || null,
    }).select("id").single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (e: any) {
    return { success: false, error: e?.message || "Failed" };
  }
}

/* ── Presigned Upload URL ─────────────────────────────── */

export async function getLeadMediaUploadUrl(
  orgId: string,
  filename: string,
  contentType: string,
): Promise<{ url: string | null; path: string | null; error?: string }> {
  try {
    const supabase = await getSupabase();
    const timestamp = Date.now();
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${orgId}/${timestamp}_${safe}`;

    const { data, error } = await supabase.storage
      .from("lead-media")
      .createSignedUploadUrl(storagePath);

    if (error) {
      // Fallback: use createSignedUrl for download-side access
      return { url: null, path: null, error: error.message };
    }

    return { url: data.signedUrl, path: storagePath };
  } catch (e: any) {
    return { url: null, path: null, error: e?.message || "Failed" };
  }
}

/* ── Get Embed Code ───────────────────────────────────── */

export async function getWidgetEmbedCode(widgetId: string): Promise<string> {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from("intake_widgets")
      .select("embed_token")
      .eq("id", widgetId)
      .single();

    if (!data) return "";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.iworkr.com";
    return `<div id="iworkr-intake-root" data-widget-token="${data.embed_token}"></div>\n<script src="${baseUrl}/api/widget/inject.js" async defer></script>`;
  } catch {
    return "";
  }
}
