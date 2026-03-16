"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Project Aegis — RBAC Server Actions
// Role changes, permission checks, and JWT claim management
// ═══════════════════════════════════════════════════════════════

export type OrgRole =
  | "owner"
  | "admin"
  | "manager"
  | "office_admin"
  | "senior_tech"
  | "technician"
  | "apprentice"
  | "subcontractor";

const ADMIN_ROLES: OrgRole[] = ["owner", "admin", "manager", "office_admin"];

// ── Change a member's role (calls the Edge Function for JWT refresh) ──

export async function changeMemberRole(
  targetUserId: string,
  organizationId: string,
  newRole: OrgRole,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Get the current user's auth
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { success: false, error: "Not authenticated" };
  }

  // Call the Edge Function which handles:
  // 1. Permission verification (caller must be admin/owner)
  // 2. DB role update
  // 3. JWT metadata refresh (force_refresh flag)
  // 4. Audit notification
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const response = await fetch(
    `${supabaseUrl}/functions/v1/update-member-role`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_user_id: targetUserId,
        organization_id: organizationId,
        new_role: newRole,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: result.error || `Failed with status ${response.status}`,
    };
  }

  revalidatePath("/dashboard/team");
  revalidatePath("/settings/members");

  return { success: true };
}

// ── Check if the current user has an admin role ──

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  // Fast path: check JWT claims
  const jwtRole = user.app_metadata?.role as string | undefined;
  if (jwtRole) {
    return ADMIN_ROLES.includes(jwtRole as OrgRole);
  }

  // Fallback: query DB
  const { data } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  return data ? ADMIN_ROLES.includes(data.role) : false;
}

// ── Get the current user's role from JWT or DB ──

export async function getCurrentUserRole(): Promise<{
  role: string;
  orgId: string | null;
  isSuper: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { role: "technician", orgId: null, isSuper: false };
  }

  // Fast path: JWT claims
  const jwtRole = user.app_metadata?.role as string | undefined;
  const jwtOrgId = user.app_metadata?.org_id as string | undefined;
  const jwtSuper = user.app_metadata?.is_super_admin === true;

  if (jwtRole) {
    return { role: jwtRole, orgId: jwtOrgId || null, isSuper: jwtSuper };
  }

  // Fallback: query DB
  const { data } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("organization_members")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (data) {
    return {
      role: data.role,
      orgId: data.organization_id,
      isSuper: jwtSuper,
    };
  }

  return { role: "technician", orgId: null, isSuper: jwtSuper };
}
