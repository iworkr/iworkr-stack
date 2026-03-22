/**
 * @module AegisRBAC Server Actions
 * @status COMPLETE
 * @description Fine-grained RBAC permission management — system permissions, role permissions, and audit logging
 * @exports fetchPermissionsAction, assignPermissionAction, revokePermissionAction, fetchRolePermissionsAction, fetchPermissionAuditLogAction
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Tables like system_permissions, role_permissions, permission_audit_log
// are not in the generated Database types — use untyped SupabaseClient for those.
type SupabaseRbac = SupabaseClient;

// ── Types ─────────────────────────────────────────────────────
export type Permission = {
  id: string;
  module: string;
  action: string;
  human_description: string | null;
  is_dangerous: boolean;
  depends_on: string | null;
  sort_order: number;
};

export type WorkspaceRole = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description: string | null;
  is_system_role: boolean;
  is_immutable: boolean;
  is_default_for_new_members: boolean;
  permissions: Record<string, unknown>;
  scopes: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  permission_ids?: string[];
  member_count?: number;
};

export type RbacStats = {
  total_roles: number;
  total_permissions: number;
  custom_roles: number;
  members_with_custom_roles: number;
  members_on_legacy_roles: number;
};

export type AuditEntry = {
  id: string;
  organization_id: string;
  actor_id: string;
  action: string;
  target_role_id: string | null;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  role_name?: string;
};

export type MemberWithRole = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  org_role: string;
  role_id: string | null;
  role_name: string | null;
  role_color: string | null;
  status: string;
};

// ── Permission Queries ────────────────────────────────────────
export async function getAllPermissions(): Promise<{ data: Permission[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac)
    .from("system_permissions")
    .select("*")
    .order("sort_order", { ascending: true });
  return { data: (data ?? []) as Permission[], error: error?.message ?? null };
}

export async function getPermissionsByModule(): Promise<{ data: Record<string, Permission[]> | null; error: string | null }> {
  // Hyperion-Vanguard S-02: Auth gate
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await getAllPermissions();
  if (error || !data) return { data: null, error };
  const grouped: Record<string, Permission[]> = {};
  for (const p of data) {
    if (!grouped[p.module]) grouped[p.module] = [];
    grouped[p.module].push(p);
  }
  return { data: grouped, error: null };
}

// ── Role Queries ──────────────────────────────────────────────
export async function getRoles(orgId: string): Promise<{ data: WorkspaceRole[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data: roles, error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .select("*")
    .eq("organization_id", orgId)
    .order("is_system_role", { ascending: false })
    .order("name");

  if (error) return { data: null, error: error.message };
  if (!roles) return { data: [], error: null };

  // Get permission counts for each role
  type RoleRow = { id: string } & Record<string, unknown>;
  type PermRow = { permission_id: string };
  type MemberRoleRow = { role_id: string };
  const rolesWithPerms = await Promise.all(
    (roles as RoleRow[]).map(async (role: RoleRow) => {
      const { data: perms } = await (supabase as SupabaseRbac)
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", role.id);
      return {
        ...role,
        permission_ids: ((perms ?? []) as PermRow[]).map((p) => p.permission_id),
        member_count: 0,
      } as WorkspaceRole;
    })
  );

  // Get member counts
  const { data: members } = await (supabase as SupabaseRbac)
    .from("organization_members")
    .select("role_id")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .not("role_id", "is", null);

  if (members) {
    for (const m of members as MemberRoleRow[]) {
      const matchedRole = rolesWithPerms.find((r) => r.id === m.role_id);
      if (matchedRole) matchedRole.member_count = (matchedRole.member_count ?? 0) + 1;
    }
  }

  return { data: rolesWithPerms, error: null };
}

export async function getRoleDetail(roleId: string): Promise<{ data: WorkspaceRole | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data: role, error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .select("*")
    .eq("id", roleId)
    .single();

  if (error || !role) return { data: null, error: error?.message ?? "Role not found" };

  const { data: perms } = await (supabase as SupabaseRbac)
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  const roleObj = role as Record<string, unknown>;
  return {
    data: {
      ...roleObj,
      permission_ids: ((perms ?? []) as { permission_id: string }[]).map((p) => p.permission_id),
    } as WorkspaceRole,
    error: null,
  };
}

// ── Role Mutations ────────────────────────────────────────────
export async function createRole(
  orgId: string,
  name: string,
  color: string,
  description?: string
): Promise<{ data: WorkspaceRole | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .insert({ organization_id: orgId, name, color, description, is_system_role: false })
    .select()
    .single();

  if (data) {
    // Log audit (user already verified by auth gate above)
    await (supabase as SupabaseRbac).from("permission_audit_log").insert({
      organization_id: orgId,
      actor_id: user.id,
      action: "role_created",
      target_role_id: data.id,
      details: { name, color },
    });
  }

  return { data: data ? { ...(data as Record<string, unknown>), permission_ids: [] } as unknown as WorkspaceRole : null, error: error?.message ?? null };
}

export async function updateRole(
  roleId: string,
  updates: { name?: string; color?: string; description?: string }
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };
  const { error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", roleId);
  return { error: error?.message ?? null };
}

export async function deleteRole(roleId: string, orgId: string): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };

  // Check if role is immutable
  const { data: role } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .select("is_immutable, name")
    .eq("id", roleId)
    .single();

  if (role?.is_immutable) return { error: "Cannot delete an immutable system role" };

  // Unassign members first
  await (supabase as SupabaseRbac)
    .from("organization_members")
    .update({ role_id: null })
    .eq("role_id", roleId);

  // Log audit (user already verified by auth gate above)
  await (supabase as SupabaseRbac).from("permission_audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: "role_deleted",
    target_role_id: roleId,
    details: { name: role?.name },
  });

  const { error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .delete()
    .eq("id", roleId);
  return { error: error?.message ?? null };
}

// ── Permission Assignments ────────────────────────────────────
export async function setRolePermissions(
  roleId: string,
  permissionIds: string[],
  orgId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };

  // Delete existing
  await (supabase as SupabaseRbac).from("role_permissions").delete().eq("role_id", roleId);

  // Insert new
  if (permissionIds.length > 0) {
    const rows = permissionIds.map((pid) => ({
      role_id: roleId,
      permission_id: pid,
      granted_by: user?.id ?? null,
    }));
    const { error } = await (supabase as SupabaseRbac).from("role_permissions").insert(rows);
    if (error) return { error: error.message };
  }

  // Audit (user already verified by auth gate above)
  await (supabase as SupabaseRbac).from("permission_audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: "permissions_updated",
    target_role_id: roleId,
    details: { permission_count: permissionIds.length },
  });

  return { error: null };
}

export async function toggleRolePermission(
  roleId: string,
  permissionId: string,
  enabled: boolean,
  orgId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };

  if (enabled) {
    const { error } = await (supabase as SupabaseRbac).from("role_permissions").upsert({
      role_id: roleId,
      permission_id: permissionId,
      granted_by: user?.id ?? null,
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await (supabase as SupabaseRbac)
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) return { error: error.message };
  }

  // Audit (user already verified by auth gate above)
  await (supabase as SupabaseRbac).from("permission_audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: enabled ? "permission_granted" : "permission_revoked",
    target_role_id: roleId,
    details: { permission_id: permissionId },
  });

  return { error: null };
}

// ── Member Management ─────────────────────────────────────────
export async function assignRoleToMember(
  orgId: string,
  userId: string,
  roleId: string | null
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };

  const { error } = await (supabase as SupabaseRbac)
    .from("organization_members")
    .update({ role_id: roleId })
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  // Audit (user already verified by auth gate above)
  await (supabase as SupabaseRbac).from("permission_audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: roleId ? "role_assigned" : "role_unassigned",
    target_user_id: userId,
    details: { role_id: roleId },
  });

  return { error: error?.message ?? null };
}

export async function getMembersWithRoles(orgId: string): Promise<{ data: MemberWithRole[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac)
    .from("organization_members")
    .select(`
      user_id,
      role:role,
      role_id,
      status,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("organization_id", orgId)
    .eq("status", "active");

  if (error) return { data: null, error: error.message };

  // Get role names
  const { data: roles } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .select("id, name, color")
    .eq("organization_id", orgId);

  type RoleRow = { id: string; name: string; color: string };
  type MemberRow = {
    user_id: string;
    role_id: string | null;
    role?: string;
    status?: string;
    profiles?: { full_name?: string | null; email?: string | null; avatar_url?: string | null } | null;
  };
  const roleMap = new Map<string, { id: string; name: string; color: string }>(
    ((roles ?? []) as RoleRow[]).map((r) => [r.id, r])
  );

  const memberList: MemberWithRole[] = ((data ?? []) as MemberRow[]).map((m) => {
    const profile = m.profiles;
    const roleData = m.role_id ? roleMap.get(m.role_id) : null;
    return {
      user_id: m.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
      org_role: m.role ?? "technician",
      role_id: m.role_id ?? null,
      role_name: roleData?.name ?? null,
      role_color: roleData?.color ?? null,
      status: m.status ?? "active",
    };
  });

  return { data: memberList, error: null };
}

// ── Permissions Lookup ────────────────────────────────────────
export async function getUserPermissions(
  userId: string,
  orgId: string
): Promise<{ data: { permissions: string[]; role_name: string; is_owner: boolean } | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac).rpc("get_user_permissions", {
    p_user_id: userId,
    p_org_id: orgId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as { permissions: string[]; role_name: string; is_owner: boolean }, error: null };
}

// ── Stats ─────────────────────────────────────────────────────
export async function getRbacStats(orgId: string): Promise<{ data: RbacStats | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac).rpc("get_rbac_stats", { p_org_id: orgId });
  if (error) return { data: null, error: error.message };
  return { data: data as RbacStats, error: null };
}

// ── Duplicate Role ────────────────────────────────────────────
export async function duplicateRole(
  roleId: string,
  orgId: string,
  newName: string
): Promise<{ data: WorkspaceRole | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };

  // Get original role
  const { data: original } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .select("*")
    .eq("id", roleId)
    .single();

  if (!original) return { data: null, error: "Original role not found" };

  // Create new role
  const { data: newRole, error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .insert({
      organization_id: orgId,
      name: newName,
      color: original.color,
      description: original.description,
      is_system_role: false,
    })
    .select()
    .single();

  if (error || !newRole) return { data: null, error: error?.message ?? "Failed to create role" };

  // Copy permissions
  const { data: perms } = await (supabase as SupabaseRbac)
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  if (perms && perms.length > 0) {
    // user already verified by auth gate above
    await (supabase as SupabaseRbac).from("role_permissions").insert(
      (perms as { permission_id: string }[]).map((p) => ({
        role_id: newRole.id,
        permission_id: p.permission_id,
        granted_by: user?.id ?? null,
      }))
    );
  }

  return {
    data: { ...newRole, permission_ids: ((perms ?? []) as { permission_id: string }[]).map((p) => p.permission_id) } as WorkspaceRole,
    error: null,
  };
}

// ── Audit Log ─────────────────────────────────────────────────
export async function getAuditLog(orgId: string, limit = 100): Promise<{ data: AuditEntry[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac)
    .from("permission_audit_log")
    .select(`
      *,
      actor:actor_id (full_name),
      role:target_role_id (name)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error: error.message };

  type AuditRow = {
    id: string;
    organization_id: string;
    actor_id: string;
    action: string;
    target_role_id: string | null;
    target_user_id: string | null;
    details: Record<string, unknown>;
    created_at: string;
    actor?: { full_name?: string } | null;
    role?: { name?: string } | null;
  };
  const entries: AuditEntry[] = ((data ?? []) as AuditRow[]).map((row) => ({
    id: row.id,
    organization_id: row.organization_id,
    actor_id: row.actor_id,
    action: row.action,
    target_role_id: row.target_role_id ?? null,
    target_user_id: row.target_user_id ?? null,
    details: row.details ?? {},
    created_at: row.created_at,
    actor_name: row.actor?.full_name,
    role_name: row.role?.name,
  }));

  return { data: entries, error: null };
}

// ── Default Role ──────────────────────────────────────────────
export async function setDefaultRole(
  orgId: string,
  roleId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { error: "Unauthorized" };
  // Unset all defaults first
  await (supabase as SupabaseRbac)
    .from("organization_roles")
    .update({ is_default_for_new_members: false })
    .eq("organization_id", orgId);

  const { error } = await (supabase as SupabaseRbac)
    .from("organization_roles")
    .update({ is_default_for_new_members: true })
    .eq("id", roleId);

  return { error: error?.message ?? null };
}

// ── Impersonation (Read-only preview) ─────────────────────────
export async function getImpersonationPermissions(
  roleId: string
): Promise<{ data: string[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { data: null, error: "Unauthorized" };
  const { data, error } = await (supabase as SupabaseRbac)
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);

  if (error) return { data: null, error: error.message };
  return { data: ((data ?? []) as { permission_id: string }[]).map((p) => p.permission_id), error: null };
}

// ── Batch Migration ───────────────────────────────────────────
export async function migrateToCustomRole(
  orgId: string,
  legacyRole: string,
  targetRoleId: string
): Promise<{ count: number; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  // Hyperion-Vanguard S-02: Auth gate
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return { count: 0, error: "Unauthorized" };

  // Get all members with this legacy role and no custom role
  const { data: members, error: fetchErr } = await (supabase as SupabaseRbac)
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", legacyRole)
    .is("role_id", null)
    .eq("status", "active");

  if (fetchErr) return { count: 0, error: fetchErr.message };
  if (!members || members.length === 0) return { count: 0, error: null };

  const userIds = (members as { user_id: string }[]).map((m) => m.user_id);

  const { error } = await (supabase as SupabaseRbac)
    .from("organization_members")
    .update({ role_id: targetRoleId })
    .eq("organization_id", orgId)
    .in("user_id", userIds);

  if (error) return { count: 0, error: error.message };

  // Audit (user already verified by auth gate above)
  await (supabase as SupabaseRbac).from("permission_audit_log").insert({
    organization_id: orgId,
    actor_id: user.id,
    action: "batch_migration",
    details: { legacy_role: legacyRole, target_role_id: targetRoleId, count: userIds.length },
  });

  return { count: userIds.length, error: null };
}
