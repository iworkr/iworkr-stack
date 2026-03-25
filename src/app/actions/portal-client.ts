/**
 * @module PortalClient Server Actions
 * @status COMPLETE
 * @description Unified client portal — trades B2C, facility manager B2B, and NDIS family flows.
 *   Handles portal user management, access grants, magic links, invoices, quotes, assets,
 *   budget summaries, and shift sign-off for the Panopticon-Client portal.
 * @lastAudit 2026-03-24
 */
"use server";

import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

export type PortalGrantType =
  | "TRADES_CUSTOMER"
  | "FACILITY_MANAGER"
  | "NDIS_PARTICIPANT"
  | "NDIS_GUARDIAN"
  | "NDIS_PLAN_MANAGER";

export interface PortalUser {
  id: string;
  email: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface PortalAccessGrant {
  id: string;
  portal_user_id: string;
  workspace_id: string;
  target_entity_type: string;
  target_entity_id: string;
  grant_type: PortalGrantType;
  is_active: boolean;
  permissions: Record<string, unknown>;
  granted_at: string;
  expires_at: string | null;
  entity_name?: string;
}

export interface PortalWorkspaceConfig {
  ok: boolean;
  workspace_id: string;
  name: string;
  slug: string;
  trade: string | null;
  logo_url: string | null;
  brand_color: string;
  text_on_brand: string;
  logo_light: string | null;
  logo_dark: string | null;
  app_name: string;
  welcome_text: string | null;
  idle_timeout: number;
  error?: string;
}

export interface PortalInvoice {
  id: string;
  display_id: string;
  client_name: string | null;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  tax_rate: number;
  due_date: string | null;
  paid_date: string | null;
  secure_token: string | null;
  created_at: string;
}

export interface PortalQuote {
  id: string;
  display_id: string;
  title: string | null;
  client_name: string | null;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  tax_rate: number;
  valid_until: string | null;
  secure_token: string | null;
  created_at: string;
}

export interface PortalAsset {
  id: string;
  name: string;
  asset_type: string;
  location: string | null;
  serial_number: string | null;
  status: string;
  last_service_date: string | null;
  next_service_date: string | null;
  jobs: Array<{
    id: string;
    title: string;
    status: string;
    completed_at: string | null;
    technician_name: string | null;
  }>;
}

export interface BudgetSummary {
  participant_id: string;
  agreement_id: string;
  agreement_title: string | null;
  plan_total: number;
  funds_utilized: number;
  funds_quarantined: number;
  funds_remaining: number;
  burn_rate_pct: number;
  plan_start_date: string | null;
  plan_end_date: string | null;
  support_category: string | null;
}

/* ═══════════════════════════════════════════════════════════════════
   Internal Helpers
   ═══════════════════════════════════════════════════════════════════ */

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

async function getAuthedPortalUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

/* ═══════════════════════════════════════════════════════════════════
   1) WORKSPACE CONFIG — White-label resolution by slug
   ═══════════════════════════════════════════════════════════════════ */

export async function getWorkspacePortalConfig(
  slug: string
): Promise<PortalWorkspaceConfig> {
  try {
    const admin = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("get_workspace_portal_config", {
      p_slug: slug,
    });
    if (error || !data?.ok) {
      return {
        ok: false,
        workspace_id: "",
        name: "",
        slug: "",
        trade: null,
        logo_url: null,
        brand_color: "#10B981",
        text_on_brand: "#FFFFFF",
        logo_light: null,
        logo_dark: null,
        app_name: "",
        welcome_text: null,
        idle_timeout: 15,
        error: error?.message || data?.error || "Portal not found",
      };
    }
    return data as PortalWorkspaceConfig;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load portal config";
    return {
      ok: false,
      workspace_id: "",
      name: "",
      slug: "",
      trade: null,
      logo_url: null,
      brand_color: "#10B981",
      text_on_brand: "#FFFFFF",
      logo_light: null,
      logo_dark: null,
      app_name: "",
      welcome_text: null,
      idle_timeout: 15,
      error: msg,
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   2) MAGIC LINK — Resolve token for anonymous access
   ═══════════════════════════════════════════════════════════════════ */

export interface MagicLinkResult {
  ok: boolean;
  workspace_id?: string;
  target_type?: string;
  target_id?: string;
  grant_type?: string;
  error?: string;
}

export async function resolveMagicLink(token: string): Promise<MagicLinkResult> {
  try {
    const admin = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("resolve_magic_link", {
      p_token: token,
    });
    if (error) return { ok: false, error: error.message };
    return data as MagicLinkResult;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to resolve magic link";
    return { ok: false, error: msg };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   3) PORTAL DASHBOARD — User grants + entity list
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalDashboardData(workspaceId: string) {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_portal_user_dashboard", {
      p_workspace_id: workspaceId,
    });
    if (error) return { error: error.message };
    return data as {
      ok: boolean;
      user: { id: string; email: string; full_name: string; phone: string | null };
      workspace: { id: string; name: string; trade: string | null };
      grants: Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        grant_type: PortalGrantType;
        entity_name: string;
      }>;
      error?: string;
    };
  } catch {
    return { error: "Not authenticated" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   4) INVOICES — Portal user's granted invoices
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalInvoices(
  workspaceId: string,
  clientId?: string
): Promise<{ invoices: PortalInvoice[]; error?: string }> {
  try {
    const { supabase } = await getAuthedPortalUser();

    let query = supabase
      .from("invoices")
      .select(
        "id, display_id, client_name, status, total, subtotal, tax, tax_rate, due_date, paid_date, secure_token, created_at"
      )
      .eq("organization_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (error) return { invoices: [], error: error.message };
    return { invoices: (data || []) as unknown as PortalInvoice[] };
  } catch {
    return { invoices: [], error: "Failed to load invoices" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   5) QUOTES — Portal user's granted quotes
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalQuotes(
  workspaceId: string,
  clientId?: string
): Promise<{ quotes: PortalQuote[]; error?: string }> {
  try {
    const { supabase } = await getAuthedPortalUser();

    let query = supabase
      .from("quotes")
      .select(
        "id, display_id, title, client_name, status, total, subtotal, tax, tax_rate, valid_until, secure_token, created_at"
      )
      .eq("organization_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (error) return { quotes: [], error: error.message };
    return { quotes: (data || []) as unknown as PortalQuote[] };
  } catch {
    return { quotes: [], error: "Failed to load quotes" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   6) ASSETS — Commercial facility manager asset vault
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalAssets(
  workspaceId: string,
  clientId: string
): Promise<{ assets: PortalAsset[]; error?: string }> {
  try {
    const { supabase } = await getAuthedPortalUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assets, error } = await (supabase as any)
      .from("assets")
      .select("id, name, asset_type, location, serial_number, status, last_service_date, next_service_date")
      .eq("organization_id", workspaceId)
      .eq("client_id", clientId)
      .order("name");

    if (error) return { assets: [], error: error.message };

    const enriched: PortalAsset[] = [];
    for (const asset of assets || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobs } = await (supabase as any)
        .from("jobs")
        .select("id, title, status, completed_at, technician_id, profiles:technician_id(full_name)")
        .eq("asset_id", asset.id)
        .order("created_at", { ascending: false })
        .limit(10);

      enriched.push({
        ...asset,
        jobs: (jobs || []).map((j: Record<string, unknown>) => ({
          id: j.id as string,
          title: j.title as string,
          status: j.status as string,
          completed_at: j.completed_at as string | null,
          technician_name: (j.profiles as { full_name?: string } | null)?.full_name || null,
        })),
      });
    }

    return { assets: enriched };
  } catch {
    return { assets: [], error: "Failed to load assets" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   7) BUDGET SUMMARY — NDIS plan budget for portal display
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalBudgetSummary(
  participantId: string
): Promise<{ budget: BudgetSummary | null; telemetry: Record<string, unknown> | null; error?: string }> {
  try {
    const { supabase } = await getAuthedPortalUser();

    // Use the secure budget view
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: budgetData, error: budgetError } = await (supabase as any)
      .from("v_participant_budget_summary")
      .select("*")
      .eq("participant_id", participantId)
      .limit(1)
      .maybeSingle();

    if (budgetError) return { budget: null, telemetry: null, error: budgetError.message };

    // Also get the Hearth telemetry RPC for richer data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: telemetry } = await (supabase as any).rpc("get_hearth_budget_telemetry", {
      p_participant_id: participantId,
    });

    return {
      budget: budgetData as BudgetSummary | null,
      telemetry: telemetry as Record<string, unknown> | null,
    };
  } catch {
    return { budget: null, telemetry: null, error: "Failed to load budget" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   8) SHIFT SIGN-OFF — Digital signature capture for shift verification
   ═══════════════════════════════════════════════════════════════════ */

export async function signShiftPortal(
  shiftId: string,
  signatureDataUrl: string,
  deviceInfo?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("sign_shift_portal", {
      p_shift_id: shiftId,
      p_signature_url: signatureDataUrl,
      p_device_info: deviceInfo || null,
    });
    if (error) return { ok: false, error: error.message };
    const result = data as { ok: boolean; error?: string };
    if (result.ok) {
      revalidatePath("/portal");
    }
    return result;
  } catch {
    return { ok: false, error: "Failed to sign shift" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   9) PORTAL ROSTER — Client-safe shift list for care portal
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalCareRoster(
  participantId: string,
  from?: string,
  to?: string
) {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_portal_roster", {
      p_participant_id: participantId,
      p_from: from || new Date(Date.now() - 7 * 86400000).toISOString(),
      p_to: to || new Date(Date.now() + 28 * 86400000).toISOString(),
    });
    if (error) return { shifts: [], error: error.message };
    return { shifts: data || [] };
  } catch {
    return { shifts: [], error: "Failed to load roster" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   10) ADMIN: Portal Grant Management
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalGrants(orgId: string) {
  try {
    const { supabase, user } = await getAuthedPortalUser();

    // Verify admin access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return { grants: [], error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("portal_access_grants")
      .select(`
        *,
        portal_users(email, full_name, phone_number)
      `)
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { grants: [], error: error.message };
    return { grants: data || [] };
  } catch {
    return { grants: [], error: "Failed to load grants" };
  }
}

export interface PortalGrantResult {
  ok: boolean;
  magic_token?: string;
  error?: string;
}

export async function createPortalGrant(
  orgId: string,
  email: string,
  fullName: string,
  entityType: string,
  entityId: string,
  grantType: PortalGrantType,
  phone?: string
): Promise<PortalGrantResult> {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("create_portal_invite", {
      p_workspace_id: orgId,
      p_email: email,
      p_full_name: fullName,
      p_phone: phone || null,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_grant_type: grantType,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/portal");
    return data as PortalGrantResult;
  } catch {
    return { ok: false, error: "Failed to create portal grant" };
  }
}

export async function revokePortalGrant(grantId: string) {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("portal_access_grants")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", grantId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/portal");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to revoke grant" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   11) ADMIN: Portal Settings
   ═══════════════════════════════════════════════════════════════════ */

export async function updatePortalSettings(
  orgId: string,
  settings: {
    portal_enabled?: boolean;
    portal_primary_color?: string;
    portal_logo_url?: string;
    portal_app_name?: string;
    portal_welcome_text?: string;
    portal_idle_timeout?: number;
    portal_custom_domain?: string;
  }
) {
  try {
    const { supabase, user } = await getAuthedPortalUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { ok: false, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("organizations")
      .update(settings)
      .eq("id", orgId);

    if (error) return { ok: false, error: error.message };
    revalidatePath("/dashboard/settings/portal");
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to update settings" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   12) PORTAL DOCUMENTS — Care documents visible to portal users
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalCareDocuments(participantId: string) {
  try {
    const { supabase } = await getAuthedPortalUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("participant_documents")
      .select("id, title, file_path, mime_type, status, requires_signature, signed_at, created_at")
      .eq("participant_id", participantId)
      .eq("is_visible_to_family", true)
      .order("created_at", { ascending: false });

    if (error) return { documents: [], error: error.message };
    return { documents: data || [] };
  } catch {
    return { documents: [], error: "Failed to load documents" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   13) PENDING SHIFTS — Shifts requiring client sign-off
   ═══════════════════════════════════════════════════════════════════ */

export async function getPortalPendingShifts(participantId: string) {
  try {
    const { supabase } = await getAuthedPortalUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_portal_roster", {
      p_participant_id: participantId,
      p_from: new Date(Date.now() - 30 * 86400000).toISOString(),
      p_to: new Date().toISOString(),
    });
    if (error) return { shifts: [], error: error.message };
    const pending = (data || []).filter(
      (s: Record<string, unknown>) =>
        s.status === "complete" && !s.client_approved
    );
    return { shifts: pending };
  } catch {
    return { shifts: [], error: "Failed to load pending shifts" };
  }
}
