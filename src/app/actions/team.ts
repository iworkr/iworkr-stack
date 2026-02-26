"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

/* ── Types ─────────────────────────────────────────── */

export interface TeamOverview {
  active_members: number;
  pending_invites: number;
  suspended_members: number;
  total_roles: number;
  branches: string[];
}

export interface MemberStats {
  jobs_done: number;
  avg_rating: number;
}

/* ── Members ───────────────────────────────────────── */

export async function getTeamMembers(orgId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `
        user_id,
        role,
        role_id,
        status,
        branch,
        skills,
        hourly_rate,
        joined_at,
        last_active_at,
        profiles:user_id (
          id,
          full_name,
          email,
          avatar_url,
          phone,
          timezone
        ),
        organization_roles:role_id (
          id,
          name,
          color,
          permissions,
          scopes
        )
      `
      )
      .eq("organization_id", orgId)
      .in("status", ["active", "pending", "suspended"])
      .order("joined_at", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: string,
  roleId?: string
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const updates: any = { role };
    if (roleId) updates.role_id = roleId;

    const { error } = await supabase
      .from("organization_members")
      .update(updates)
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateMemberDetails(
  orgId: string,
  userId: string,
  updates: {
    branch?: string;
    skills?: string[];
    hourly_rate?: number;
    status?: string;
  }
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { error } = await supabase
      .from("organization_members")
      .update(updates)
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function suspendMember(orgId: string, userId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { error } = await supabase
      .from("organization_members")
      .update({ status: "suspended" })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function reactivateMember(orgId: string, userId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { error } = await supabase
      .from("organization_members")
      .update({ status: "active" })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function removeMember(orgId: string, userId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { error } = await supabase
      .from("organization_members")
      .update({ status: "archived" })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Roles ─────────────────────────────────────────── */

export async function getRoles(orgId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("organization_roles")
      .select("*")
      .eq("organization_id", orgId)
      .order("is_system_role", { ascending: false })
      .order("name");

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getRolesWithCounts(orgId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase.rpc("get_roles_with_counts", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("getRolesWithCounts RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error("getRolesWithCounts exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function createRole(params: {
  organization_id: string;
  name: string;
  color: string;
  permissions: any;
  scopes?: any;
}) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("organization_roles")
      .insert(params)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateRole(
  roleId: string,
  updates: {
    name?: string;
    color?: string;
    permissions?: any;
    scopes?: any;
  }
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("organization_roles")
      .update(updates)
      .eq("id", roleId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateRolePermissions(
  roleId: string,
  permissions: any,
  scopes?: any
) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase.rpc("update_role_permissions", {
      p_role_id: roleId,
      p_permissions: permissions,
      p_scopes: scopes || null,
    });

    if (error) {
      logger.error("updateRolePermissions RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/team");
    return { data, error: null };
  } catch (err: any) {
    logger.error("updateRolePermissions exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function deleteRole(roleId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    // Prevent deletion of system roles
    const { data: role } = await supabase
      .from("organization_roles")
      .select("is_system_role")
      .eq("id", roleId)
      .maybeSingle();

    if (role?.is_system_role) {
      return { data: null, error: "Cannot delete system roles" };
    }

    const { error } = await supabase
      .from("organization_roles")
      .delete()
      .eq("id", roleId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Invites ───────────────────────────────────────── */

export async function getTeamInvites(orgId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("organization_invites")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function inviteMember(params: {
  organization_id: string;
  email: string;
  role: string;
  role_id?: string;
  branch?: string;
}) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase.rpc("invite_member", {
      p_org_id: params.organization_id,
      p_email: params.email,
      p_role: params.role,
      p_role_id: params.role_id || null,
      p_branch: params.branch || "HQ",
      p_actor_id: user?.id || null,
    });

    if (error) {
      logger.error("inviteMember RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/team");
    return { data, error: null };
  } catch (err: any) {
    logger.error("inviteMember exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function resendInvite(inviteId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    // Use the Genesis RPC — resets expiry to +7 days and status back to 'pending'
    const { data, error } = await supabase.rpc("resend_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      logger.error("resendInvite RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/team");
    return { data, error: null };
  } catch (err: any) {
    logger.error("resendInvite exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function cancelInvite(inviteId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    // Use the Genesis RPC — sets status to 'revoked' (not 'expired')
    // so we distinguish admin cancellation from time-based expiry
    const { data, error } = await supabase.rpc("revoke_invite", {
      p_invite_id: inviteId,
    });

    if (error) {
      logger.error("cancelInvite (revoke) RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/team");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    logger.error("cancelInvite exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Permission Check ─────────────────────────────── */

export async function checkPermission(
  orgId: string,
  module: string,
  action: string
): Promise<boolean> {
  try {
    const supabase = (await createServerSupabaseClient()) as any;
    const { data, error } = await supabase.rpc("has_permission", {
      p_org_id: orgId,
      p_module: module,
      p_action: action,
    });
    if (error) {
      logger.error("checkPermission RPC error", error.message);
      return false;
    }
    return !!data;
  } catch (err: any) {
    logger.error("checkPermission exception", err.message);
    return false;
  }
}

/* ── Stats & Overview ──────────────────────────────── */

export async function getMemberStats(orgId: string, userId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase.rpc("get_member_stats", {
      p_org_id: orgId,
      p_user_id: userId,
    });

    if (error) {
      logger.error("getMemberStats RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data: data as MemberStats, error: null };
  } catch (err: any) {
    logger.error("getMemberStats exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function getTeamOverview(
  orgId: string
): Promise<{ data: TeamOverview | null; error: string | null }> {
  try {
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase.rpc("get_team_overview", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("getTeamOverview RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error("getTeamOverview exception", err.message);
    return { data: null, error: err.message };
  }
}
