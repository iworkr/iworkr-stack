"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

/* ── CRUD ─────────────────────────────────────────── */

export async function getBranches(orgId: string): Promise<{ data: Branch[]; error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_headquarters", { ascending: false })
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
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
  const supabase = (await createServerSupabaseClient()) as any;
  const { data, error } = await supabase
    .from("branches")
    .insert(params)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  revalidatePath("/settings/branches");
  return { data };
}

export async function updateBranch(
  branchId: string,
  updates: Partial<Omit<Branch, "id" | "organization_id" | "created_at">>
): Promise<{ error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;
  const { error } = await supabase
    .from("branches")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", branchId);

  if (error) return { error: error.message };
  revalidatePath("/settings/branches");
  return {};
}

export async function deleteBranch(branchId: string): Promise<{ error?: string }> {
  const supabase = (await createServerSupabaseClient()) as any;

  // Prevent deleting HQ
  const { data: branch } = await supabase
    .from("branches")
    .select("is_headquarters")
    .eq("id", branchId)
    .maybeSingle();

  if (branch?.is_headquarters) return { error: "Cannot delete headquarters branch" };

  const { error } = await supabase
    .from("branches")
    .delete()
    .eq("id", branchId);

  if (error) return { error: error.message };
  revalidatePath("/settings/branches");
  return {};
}
