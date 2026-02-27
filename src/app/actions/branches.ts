"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validate, uuidSchema, emailSchema, phoneSchema } from "@/lib/validation";

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

const CreateBranchSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1, "Name is required").max(100),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal("")),
  tax_rate: z.number().min(0).max(100).optional(),
});

const UpdateBranchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postal_code: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional(),
  timezone: z.string().max(50).optional(),
  phone: phoneSchema.nullable(),
  email: emailSchema.optional().nullable().or(z.literal("")),
  tax_rate: z.number().min(0).max(100).optional(),
  is_headquarters: z.boolean().optional(),
  ai_agent_phone: z.string().max(30).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

/* ── CRUD ─────────────────────────────────────────── */

export async function getBranches(orgId: string): Promise<{ data: Branch[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_headquarters", { ascending: false })
    .order("name");

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as Branch[] };
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
  // Validate input
  const validated = validate(CreateBranchSchema, params);
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

  const { data, error } = await supabase
    .from("branches")
    .insert(params)
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  revalidatePath("/settings/branches");
  return { data: data as Branch };
}

export async function updateBranch(
  branchId: string,
  updates: Partial<Omit<Branch, "id" | "organization_id" | "created_at">>
): Promise<{ error?: string }> {
  // Validate input
  const validated = validate(UpdateBranchSchema, updates);
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
}

export async function deleteBranch(branchId: string): Promise<{ error?: string }> {
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
}
