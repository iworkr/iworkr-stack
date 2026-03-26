/**
 * @module Branches Server Actions
 * @status COMPLETE
 * @description Multi-branch organization management — branch CRUD, staff assignments, and branch-level settings
 * @exports createBranch, updateBranch, deleteBranch, fetchBranches, assignStaffToBranch
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validate } from "@/lib/validation";
import { BranchCreateSchema, BranchUpdateSchema } from "@/lib/validations/branch";

/* ── Types ─────────────────────────────────────────── */

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  timezone: string;
  phone: string | null;
  email: string | null;
  tax_rate: number;
  is_headquarters: boolean;
  ai_agent_phone: string | null;
  status: "active" | "inactive";
  created_at: string;
}

/* ── Schemas ──────────────────────────────────────── */

/* ── CRUD ─────────────────────────────────────────── */

export async function getBranches(orgId: string): Promise<{ data: Branch[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], error: "Unauthorized" };

    const [membershipResult, branchesResult] = await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("branches")
        .select("*")
        .eq("organization_id", orgId)
        .order("is_headquarters", { ascending: false })
        .order("name"),
    ]);

    if (!membershipResult.data) return { data: [], error: "Unauthorized" };
    if (branchesResult.error) return { data: [], error: branchesResult.error.message };
    return { data: (branchesResult.data || []) as Branch[] };
  } catch (e: any) {
    console.error("[branches] getBranches failed:", e);
    return { data: [], error: e?.message || "An unexpected error occurred" };
  }
}

export async function createBranch(params: {
  organization_id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  tax_rate?: number;
}): Promise<{ data: Branch | null; error?: string }> {
  try {
    // Validate input
    const validated = validate(BranchCreateSchema, params);
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const rpcClient = supabase as any;
    const { data: rpcData, error: rpcError } = await rpcClient.rpc("create_branch", {
      p_workspace_id: params.organization_id,
      p_name: params.name,
      p_city: params.city ?? null,
      p_timezone: params.timezone ?? "Australia/Sydney",
      p_tax_rate: params.tax_rate ?? 10,
      p_location_lat: null,
      p_location_lng: null,
      p_address: params.address ?? null,
      p_state: params.state ?? null,
      p_postal_code: params.postal_code ?? null,
      p_phone: params.phone ?? null,
      p_email: params.email ?? null,
    });

    if (rpcError) return { data: null, error: rpcError.message };
    const createdId = typeof rpcData === "string" ? rpcData : rpcData?.id;
    if (!createdId) return { data: null, error: "Branch creation failed" };

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .eq("id", createdId)
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/settings/branches");
    return { data: data as Branch };
  } catch (e: any) {
    console.error("[branches] createBranch failed:", e);
    return { data: null, error: e?.message || "An unexpected error occurred" };
  }
}

export async function updateBranch(
  branchId: string,
  updates: Partial<Omit<Branch, "id" | "organization_id" | "created_at">>
): Promise<{ error?: string }> {
  try {
    // Validate input
    const validated = validate(BranchUpdateSchema, updates);
    if (validated.error) return { error: validated.error };

    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Look up the branch to get its org, then verify membership
    const { data: branch } = await supabase
      .from("branches")
      .select("organization_id")
      .eq("id", branchId)
      .maybeSingle();
    if (!branch) return { error: "Branch not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", branch.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { error: "Unauthorized" };

    const { error } = await supabase
      .from("branches")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", branchId);

    if (error) return { error: error.message };
    revalidatePath("/settings/branches");
    return {};
  } catch (e: any) {
    console.error("[branches] updateBranch failed:", e);
    return { error: e?.message || "An unexpected error occurred" };
  }
}

export async function deleteBranch(branchId: string): Promise<{ error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Prevent deleting HQ
    const { data: branch } = await supabase
      .from("branches")
      .select("is_headquarters, organization_id")
      .eq("id", branchId)
      .maybeSingle();

    if (!branch) return { error: "Branch not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", branch.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { error: "Unauthorized" };

    if (branch?.is_headquarters) return { error: "Cannot delete headquarters branch" };

    const { error } = await supabase
      .from("branches")
      .delete()
      .eq("id", branchId);

    if (error) return { error: error.message };
    revalidatePath("/settings/branches");
    return {};
  } catch (e: any) {
    console.error("[branches] deleteBranch failed:", e);
    return { error: e?.message || "An unexpected error occurred" };
  }
}
