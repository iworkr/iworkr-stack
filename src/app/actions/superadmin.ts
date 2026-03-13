/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Super Admin Server Actions
   All actions verify is_super_admin before executing.
   All mutations are logged to super_admin_audit_logs.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Helpers ─────────────────────────────────────────────────────── */

function err(msg: string) {
  return { data: null, error: msg };
}

/** Verify the calling user is a super admin. Returns user or null. */
async function verifySuperAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminSupabaseClient();

  // Try to check is_super_admin column; gracefully handle if migration 084
  // hasn't been applied yet (column doesn't exist) by falling back to email check
  const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];

  try {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, email, is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      // Column likely doesn't exist — fall back to email allowlist
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }

    if (!profile?.is_super_admin) {
      // Also check email allowlist as fallback (for when column exists but isn't set)
      if (SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    }
    return { id: user.id, email: profile.email };
  } catch {
    // Hard failure — fall back to email check
    if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
      return { id: user.id, email: user.email || "" };
    }
    return null;
  }
}

/** Log an action to the immutable audit trail */
async function logAudit(params: {
  adminId: string;
  adminEmail: string;
  actionType: string;
  targetTable?: string;
  targetRecordId?: string;
  targetOrgId?: string;
  previousState?: any;
  newState?: any;
  mutationPayload?: any;
  notes?: string;
}) {
  try {
    const admin = createAdminSupabaseClient();
    await admin.from("super_admin_audit_logs").insert({
      admin_id: params.adminId,
      admin_email: params.adminEmail,
      action_type: params.actionType,
      target_table: params.targetTable || null,
      target_record_id: params.targetRecordId || null,
      target_org_id: params.targetOrgId || null,
      previous_state: params.previousState || null,
      new_state: params.newState || null,
      mutation_payload: params.mutationPayload || null,
      notes: params.notes || null,
    });
  } catch {
    // Audit table may not exist yet (migration 084 not applied)
    // Silently skip — never block admin operations for audit failures
    console.warn("[Olympus] Audit log failed — table may not exist yet");
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 1: WORKSPACE MANAGEMENT
   ═══════════════════════════════════════════════════════════════════ */

/** List all workspaces with stats */
export async function listWorkspaces(search?: string, limit = 50, offset = 0) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    let query = admin
      .from("organizations")
      .select("*, organization_members(count), profiles!organizations_owner_id_fkey(email, full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return err(error.message);
    return { data: { rows: data, total: count }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Get a single workspace detail */
export async function getWorkspaceDetail(orgId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    const [orgResult, membersResult, featuresResult] = await Promise.all([
      admin.from("organizations").select("*").eq("id", orgId).maybeSingle(),
      admin.from("organization_members").select("*, profiles(id, email, full_name, avatar_url)").eq("organization_id", orgId),
      admin.from("organization_features").select("*").eq("organization_id", orgId).maybeSingle(),
    ]);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "VIEW_WORKSPACE",
      targetOrgId: orgId,
    });

    return {
      data: {
        organization: orgResult.data,
        members: membersResult.data || [],
        features: featuresResult.data,
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Update workspace fields */
export async function updateWorkspace(orgId: string, updates: Record<string, any>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Snapshot previous state
    const { data: prev } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();

    const { data, error } = await admin
      .from("organizations")
      .update(updates)
      .eq("id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "UPDATE_WORKSPACE",
      targetTable: "organizations",
      targetRecordId: orgId,
      targetOrgId: orgId,
      previousState: prev,
      newState: data,
      mutationPayload: updates,
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Freeze / unfreeze a workspace */
export async function toggleFreezeWorkspace(orgId: string, freeze: boolean) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin
      .from("organizations")
      .update({ status: freeze ? "frozen" : "active" })
      .eq("id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "FREEZE_WORKSPACE",
      targetOrgId: orgId,
      newState: { status: freeze ? "frozen" : "active" },
      notes: freeze ? "Workspace frozen" : "Workspace unfrozen",
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Hard delete a workspace (DANGER) */
export async function deleteWorkspace(orgId: string, confirmName: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Verify name matches
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
    if (!org || org.name !== confirmName) return err("Workspace name does not match confirmation");

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "DELETE_WORKSPACE",
      targetTable: "organizations",
      targetRecordId: orgId,
      targetOrgId: orgId,
      previousState: org,
      notes: `Hard delete confirmed with name: ${confirmName}`,
    });

    const { error } = await admin.from("organizations").delete().eq("id", orgId);
    if (error) return err(error.message);

    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 2: GLOBAL USER DIRECTORY
   ═══════════════════════════════════════════════════════════════════ */

/** List all users across all tenants */
export async function listUsers(search?: string, limit = 50, offset = 0) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    let query = admin
      .from("profiles")
      .select("*, organization_members(organization_id, role, status, organizations(name))", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) return err(error.message);
    return { data: { rows: data, total: count }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Get user detail (profile + memberships + auth metadata) */
export async function getUserDetail(userId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    const [profileResult, membershipsResult] = await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("organization_members").select("*, organizations(id, name, industry_type)").eq("user_id", userId),
    ]);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "VIEW_USER",
      targetTable: "profiles",
      targetRecordId: userId,
    });

    return {
      data: {
        profile: profileResult.data,
        memberships: membershipsResult.data || [],
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Force password reset email */
export async function sendPasswordReset(email: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "RESET_PASSWORD",
      notes: `Password reset sent to ${email}`,
    });

    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Force logout all sessions for a user */
export async function forceLogoutUser(userId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { error } = await admin.auth.admin.signOut(userId);
    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "FORCE_LOGOUT",
      targetTable: "profiles",
      targetRecordId: userId,
      notes: "All sessions terminated",
    });

    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Generate a short-lived impersonation token */
export async function impersonateUser(userId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Get user details for logging
    const { data: target } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    if (!target) return err("User not found");

    // Generate an impersonation link using Supabase Admin API
    // This creates a magic link that auto-signs in as the target user
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`,
      },
    });

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "IMPERSONATE_USER",
      targetTable: "profiles",
      targetRecordId: userId,
      notes: `Impersonating ${target.full_name} (${target.email})`,
    });

    return {
      data: {
        token: data?.properties?.hashed_token,
        email: target.email,
        name: target.full_name,
        verification_url: data?.properties?.action_link,
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 3: BILLING & SUBSCRIPTION OVERRIDES
   ═══════════════════════════════════════════════════════════════════ */

/** Override subscription for a workspace (bypass Stripe) */
export async function overrideSubscription(
  orgId: string,
  tier: "free" | "starter" | "standard" | "enterprise",
  expiresAt: string | null,
  reason: string
) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Upsert feature flags
    const { data, error } = await admin
      .from("organization_features")
      .upsert(
        {
          organization_id: orgId,
          manual_tier_override: tier,
          override_expires_at: expiresAt,
          override_reason: reason,
          override_set_by: caller.id,
        },
        { onConflict: "organization_id" }
      )
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "OVERRIDE_PLAN",
      targetOrgId: orgId,
      newState: { tier, expiresAt, reason },
      notes: `Manual override to ${tier} until ${expiresAt || "indefinite"}`,
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Toggle feature flags for a workspace */
export async function toggleFeatureFlag(orgId: string, feature: string, enabled: boolean) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    // Ensure row exists
    await admin.from("organization_features").upsert(
      { organization_id: orgId },
      { onConflict: "organization_id" }
    );

    const { data, error } = await admin
      .from("organization_features")
      .update({ [feature]: enabled })
      .eq("organization_id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "TOGGLE_FEATURE",
      targetOrgId: orgId,
      newState: { [feature]: enabled },
      notes: `${feature} set to ${enabled}`,
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Update usage quotas */
export async function updateQuotas(orgId: string, quotas: { max_storage_gb?: number; max_sms_monthly?: number; max_api_calls_daily?: number }) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    await admin.from("organization_features").upsert(
      { organization_id: orgId },
      { onConflict: "organization_id" }
    );

    const { data, error } = await admin
      .from("organization_features")
      .update(quotas)
      .eq("organization_id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "UPDATE_QUOTA",
      targetOrgId: orgId,
      newState: quotas,
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 4: DATABASE MUTATOR (SAFE GUI)
   ═══════════════════════════════════════════════════════════════════ */

/** List all public tables in the database */
export async function listTables() {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.rpc("get_table_list");

    // Fallback: if RPC doesn't exist, use information_schema
    if (error) {
      const { data: tables, error: err2 } = await admin
        .from("information_schema.tables" as any)
        .select("table_name")
        .eq("table_schema", "public")
        .eq("table_type", "BASE TABLE")
        .order("table_name");

      if (err2) {
        // If information_schema fails, return hardcoded known tables
        return {
          data: [
            "organizations", "profiles", "organization_members", "clients",
            "jobs", "shifts", "invoices", "participant_profiles",
            "service_agreements", "incidents", "care_plans", "progress_notes",
            "health_observations", "medications", "timesheets", "time_entries",
            "super_admin_audit_logs", "organization_features",
          ],
          error: null,
        };
      }
      return { data: (tables || []).map((t: any) => t.table_name), error: null };
    }

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Read rows from a table with pagination */
export async function readTableRows(tableName: string, limit = 25, offset = 0, filters?: Record<string, string>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    // Sanitize table name (prevent SQL injection)
    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");

    const admin = createAdminSupabaseClient();
    let query = admin
      .from(tableName)
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1)
      .order("created_at" as any, { ascending: false });

    // Apply filters
    if (filters) {
      for (const [col, val] of Object.entries(filters)) {
        if (val) query = query.ilike(col as any, `%${val}%`);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      // If created_at doesn't exist, try without ordering
      const { data: d2, error: e2, count: c2 } = await admin
        .from(tableName)
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1);

      if (e2) return err(e2.message);
      return { data: { rows: d2, total: c2 }, error: null };
    }

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "VIEW_TABLE",
      targetTable: tableName,
      notes: `Viewed ${tableName} (offset=${offset}, limit=${limit})`,
    });

    return { data: { rows: data, total: count }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Update a single row in a table */
export async function updateTableRow(tableName: string, recordId: string, updates: Record<string, any>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");

    const admin = createAdminSupabaseClient();

    // Snapshot previous state
    const { data: prev } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();

    const { data, error } = await admin
      .from(tableName)
      .update(updates)
      .eq("id", recordId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "UPDATE_ROW",
      targetTable: tableName,
      targetRecordId: recordId,
      previousState: prev,
      newState: data,
      mutationPayload: updates,
    });

    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Delete a single row from a table */
export async function deleteTableRow(tableName: string, recordId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");
    if (tableName === "super_admin_audit_logs") return err("Cannot delete audit logs");

    const admin = createAdminSupabaseClient();

    // Snapshot
    const { data: prev } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();

    const { error } = await admin.from(tableName).delete().eq("id", recordId);
    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "DELETE_ROW",
      targetTable: tableName,
      targetRecordId: recordId,
      previousState: prev,
      notes: `Deleted row from ${tableName}`,
    });

    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Insert a new row into a table */
export async function insertTableRow(tableName: string, data: Record<string, any>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");

    const admin = createAdminSupabaseClient();
    const { data: row, error } = await admin.from(tableName).insert(data).select().maybeSingle();
    if (error) return err(error.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "INSERT_ROW",
      targetTable: tableName,
      targetRecordId: (row as any)?.id || null,
      newState: row,
      mutationPayload: data,
    });

    return { data: row, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 5: AUDIT LOG
   ═══════════════════════════════════════════════════════════════════ */

/** Read audit logs */
export async function getAuditLogs(limit = 50, offset = 0, filters?: { action_type?: string; admin_email?: string; target_table?: string }) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    let query = admin
      .from("super_admin_audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (filters?.action_type) query = query.eq("action_type", filters.action_type);
    if (filters?.admin_email) query = query.eq("admin_email", filters.admin_email);
    if (filters?.target_table) query = query.eq("target_table", filters.target_table);

    const { data, error, count } = await query;
    if (error) return err(error.message);
    return { data: { rows: data, total: count }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 6: SYSTEM HEALTH
   ═══════════════════════════════════════════════════════════════════ */

/** Get platform-wide statistics */
export async function getSystemStats() {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();

    const [orgs, users, members, jobs] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("organization_members").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("jobs").select("id", { count: "exact", head: true }),
    ]);

    return {
      data: {
        total_workspaces: orgs.count || 0,
        total_users: users.count || 0,
        active_memberships: members.count || 0,
        total_jobs: jobs.count || 0,
      },
      error: null,
    };
  } catch (e: any) {
    return err(e.message);
  }
}
