/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

/* ── Helpers ──────────────────────────────────────────── */

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is required");
  return new Resend(key);
}

async function assertOrgAdmin(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new Error("Only owners and admins can manage branding");
  }

  return { supabase, user };
}

/* ── YIQ Contrast Calculator ────────────────────────── */

function getContrastYIQ(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

/* ── Get Workspace Branding ────────────────────────── */

export async function getWorkspaceBranding(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .select("*")
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to fetch branding" };
  }
}

/* ── Update Brand Color ─────────────────────────────── */

export async function updateBrandColor(orgId: string, hex: string) {
  try {
    if (!isValidHex(hex)) {
      return { data: null, error: "Invalid hex color. Must be format #RRGGBB" };
    }

    const { supabase } = await assertOrgAdmin(orgId);
    const textOnPrimary = getContrastYIQ(hex);

    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .update({
        primary_color_hex: hex.toUpperCase(),
        text_on_primary_hex: textOnPrimary,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Also update the legacy brand_color_hex on organizations table for backward compat
    await (supabase as any)
      .from("organizations")
      .update({ brand_color_hex: hex.toUpperCase() })
      .eq("id", orgId);

    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update brand color" };
  }
}

/* ── Update Logo URLs ────────────────────────────── */

export async function updateBrandLogo(
  orgId: string,
  logoLightUrl: string | null,
  logoDarkUrl: string | null
) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (logoLightUrl !== undefined) updates.logo_light_url = logoLightUrl;
    if (logoDarkUrl !== undefined) updates.logo_dark_url = logoDarkUrl;

    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .update(updates)
      .eq("workspace_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Update legacy logo_url on organizations
    const primaryLogo = logoLightUrl || logoDarkUrl;
    if (primaryLogo) {
      await (supabase as any)
        .from("organizations")
        .update({ logo_url: primaryLogo, brand_logo_url: primaryLogo })
        .eq("id", orgId);
    }

    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to update logo" };
  }
}

/* ── Resend: Create Custom Domain ─────────────────── */

export async function createCustomDomain(orgId: string, domain: string) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);
    const resend = getResend();

    // Clean domain
    const cleanDomain = domain.toLowerCase().trim();
    if (!cleanDomain || !cleanDomain.includes(".")) {
      return { data: null, error: "Invalid domain name" };
    }

    // Create domain via Resend API
    const domainResponse = await resend.domains.create({ name: cleanDomain });

    if (!domainResponse.data) {
      return {
        data: null,
        error: (domainResponse as any).error?.message || "Failed to create domain in Resend",
      };
    }

    const resendDomain = domainResponse.data;

    // Map DNS records from Resend response
    const dnsRecords = (resendDomain.records || []).map((record: any) => ({
      type: record.type,
      name: record.name,
      value: record.value,
      priority: record.priority || null,
      status: record.status || "pending",
    }));

    // Save to database
    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .update({
        custom_email_domain: cleanDomain,
        resend_domain_id: resendDomain.id,
        dns_status: "pending",
        dns_records: dnsRecords,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to create custom domain" };
  }
}

/* ── Resend: Verify Custom Domain ────────────────── */

export async function verifyCustomDomain(orgId: string) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);
    const resend = getResend();

    // Get current branding
    const { data: branding } = await (supabase as any)
      .from("workspace_branding")
      .select("resend_domain_id, custom_email_domain")
      .eq("workspace_id", orgId)
      .maybeSingle();

    if (!branding?.resend_domain_id) {
      return { data: null, error: "No domain configured. Add a domain first." };
    }

    // Verify via Resend API
    const verifyResponse = await resend.domains.verify(branding.resend_domain_id);

    if (!verifyResponse.data) {
      return {
        data: null,
        error: (verifyResponse as any).error?.message || "Verification failed",
      };
    }

    // Get updated domain info
    const domainInfo = await resend.domains.get(branding.resend_domain_id);

    if (!domainInfo.data) {
      return { data: null, error: "Failed to fetch updated domain status" };
    }

    // Check if all records are verified
    const records = (domainInfo.data.records || []).map((r: any) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      priority: r.priority || null,
      status: r.status || "pending",
    }));

    const allVerified = records.length > 0 && records.every((r: any) => r.status === "verified");
    const dnsStatus = allVerified ? "verified" : "pending";

    // Update database
    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .update({
        dns_status: dnsStatus,
        dns_records: records,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null, verified: allVerified };
  } catch (err: any) {
    return { data: null, error: err.message || "Verification failed" };
  }
}

/* ── Resend: Remove Custom Domain ─────────────────── */

export async function removeCustomDomain(orgId: string) {
  try {
    const { supabase } = await assertOrgAdmin(orgId);
    const resend = getResend();

    // Get current domain
    const { data: branding } = await (supabase as any)
      .from("workspace_branding")
      .select("resend_domain_id")
      .eq("workspace_id", orgId)
      .maybeSingle();

    // Delete from Resend if domain exists
    if (branding?.resend_domain_id) {
      try {
        await resend.domains.remove(branding.resend_domain_id);
      } catch {
        // Domain might already be deleted on Resend side — continue
      }
    }

    // Clear from database
    const { data, error } = await (supabase as any)
      .from("workspace_branding")
      .update({
        custom_email_domain: null,
        resend_domain_id: null,
        dns_status: "unconfigured",
        dns_records: [],
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/settings");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message || "Failed to remove domain" };
  }
}
