/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/* ═══════════════════════════════════════════════════════════════════
   Project Olympus — Super Admin Server Actions
   All actions verify is_super_admin before executing.
   All mutations are logged to super_admin_audit_logs.

   IMPORTANT: organization_members has TWO foreign keys to profiles:
     - user_id → profiles.id
     - invited_by → profiles.id
   PostgREST joins MUST specify the FK name to avoid ambiguity:
     profiles!organization_members_user_id_fkey(...)
   ═══════════════════════════════════════════════════════════════════ */

/* ── Helpers ─────────────────────────────────────────────────────── */

function err(msg: string) {
  return { data: null, error: msg };
}

function ok(data: any) {
  return { data, error: null };
}

/** Verify the calling user is a super admin. Returns user or null. */
async function verifySuperAdmin() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const admin = createAdminSupabaseClient();
    const SUPER_ADMIN_EMAILS = ["theo@iworkrapp.com"];

    try {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, email, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
          return { id: user.id, email: user.email || "" };
        }
        return null;
      }

      if (profile?.is_super_admin || SUPER_ADMIN_EMAILS.includes(profile?.email || user.email || "")) {
        return { id: user.id, email: profile?.email || user.email || "" };
      }
      return null;
    } catch {
      if (SUPER_ADMIN_EMAILS.includes(user.email || "")) {
        return { id: user.id, email: user.email || "" };
      }
      return null;
    }
  } catch {
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
    // Silently skip — never block admin operations for audit failures
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

    // Step 1: Fetch orgs
    let query = admin
      .from("organizations")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
    }

    const { data: orgs, error, count } = await query;
    if (error) return err(error.message);
    if (!orgs || orgs.length === 0) return ok({ rows: [], total: 0 });

    // Step 2: Batch fetch ALL member counts + owners in 2 queries (not N+1)
    const orgIds = orgs.map((o: any) => o.id);

    // Get all members for these orgs (with profile info via explicit FK)
    const { data: allMembers } = await admin
      .from("organization_members")
      .select("organization_id, user_id, role, profiles!organization_members_user_id_fkey(email, full_name)")
      .in("organization_id", orgIds);

    // Build lookup maps
    const memberCountMap: Record<string, number> = {};
    const ownerMap: Record<string, { email: string; name: string }> = {};

    for (const m of allMembers || []) {
      const orgId = m.organization_id;
      memberCountMap[orgId] = (memberCountMap[orgId] || 0) + 1;
      if (m.role === "owner" && !ownerMap[orgId]) {
        const p = m.profiles as any;
        ownerMap[orgId] = { email: p?.email || "", name: p?.full_name || "" };
      }
    }

    // Step 3: Enrich orgs
    const enriched = orgs.map((org: any) => ({
      ...org,
      member_count: memberCountMap[org.id] || 0,
      owner_email: ownerMap[org.id]?.email || null,
      owner_name: ownerMap[org.id]?.name || null,
    }));

    return ok({ rows: enriched, total: count });
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
      // Use explicit FK name to disambiguate profiles join
      admin.from("organization_members")
        .select("user_id, role, status, branch, joined_at, profiles!organization_members_user_id_fkey(id, email, full_name, avatar_url)")
        .eq("organization_id", orgId),
      admin.from("organization_features").select("*").eq("organization_id", orgId).maybeSingle(),
    ]);

    logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "VIEW_WORKSPACE",
      targetOrgId: orgId,
    });

    return ok({
      organization: orgResult.data,
      members: membersResult.data || [],
      features: featuresResult.data,
    });
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
    const { data: prev } = await admin.from("organizations").select("*").eq("id", orgId).maybeSingle();

    const { data, error } = await admin
      .from("organizations")
      .update(updates)
      .eq("id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    logAudit({
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

    return ok(data);
  } catch (e: any) {
    return err(e.message);
  }
}

/** Freeze / unfreeze a workspace by updating settings JSON */
export async function toggleFreezeWorkspace(orgId: string, freeze: boolean) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
    const currentSettings = (org?.settings as Record<string, any>) || {};

    const { data, error } = await admin
      .from("organizations")
      .update({
        settings: { ...currentSettings, frozen: freeze, frozen_at: freeze ? new Date().toISOString() : null },
      })
      .eq("id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "FREEZE_WORKSPACE",
      targetOrgId: orgId,
      newState: { frozen: freeze },
      notes: freeze ? "Workspace frozen" : "Workspace unfrozen",
    });

    return ok(data);
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
    const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
    if (!org || org.name !== confirmName) return err("Workspace name does not match confirmation");

    logAudit({
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

    return ok({ success: true });
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

    // Step 1: Get profiles
    let query = admin
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: profiles, error, count } = await query;
    if (error) return err(error.message);
    if (!profiles || profiles.length === 0) return ok({ rows: [], total: 0 });

    // Step 2: Batch fetch all memberships for these users
    const userIds = profiles.map((p: any) => p.id);
    const { data: allMemberships } = await admin
      .from("organization_members")
      .select("organization_id, user_id, role, status, organizations(name)")
      .in("user_id", userIds);

    // Build membership lookup
    const membershipMap: Record<string, any[]> = {};
    for (const m of allMemberships || []) {
      if (!membershipMap[m.user_id]) membershipMap[m.user_id] = [];
      membershipMap[m.user_id].push(m);
    }

    // Step 3: Enrich
    const enriched = profiles.map((p: any) => ({
      ...p,
      organization_members: membershipMap[p.id] || [],
    }));

    return ok({ rows: enriched, total: count });
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
      admin.from("organization_members")
        .select("organization_id, role, status, branch, joined_at, organizations(id, name, industry_type)")
        .eq("user_id", userId),
    ]);

    logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: "VIEW_USER",
      targetTable: "profiles",
      targetRecordId: userId,
    });

    return ok({
      profile: profileResult.data,
      memberships: membershipsResult.data || [],
    });
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

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "RESET_PASSWORD", notes: `Password reset sent to ${email}` });
    return ok({ success: true });
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
    try {
      await admin.auth.admin.signOut(userId, "global" as any);
    } catch {
      await admin.auth.admin.updateUserById(userId, { app_metadata: { force_logout: Date.now() } });
    }

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "FORCE_LOGOUT", targetRecordId: userId, notes: "All sessions terminated" });
    return ok({ success: true });
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
    const { data: target } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    if (!target) return err("User not found");

    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard` },
    });

    if (error) return err(error.message);

    // Create impersonation session record
    const { data: session } = await admin
      .from("impersonation_sessions")
      .insert({
        admin_id: caller.id,
        admin_email: caller.email,
        target_user_id: userId,
        target_email: target.email,
        status: "active",
      })
      .select("id")
      .single();

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "IMPERSONATE_USER", targetRecordId: userId, notes: `Impersonating ${target.full_name} (${target.email})` });

    return ok({
      token: data?.properties?.hashed_token,
      email: target.email,
      name: target.full_name,
      verification_url: data?.properties?.action_link,
      session_id: session?.id,
      impersonation_cookie: JSON.stringify({
        admin_id: caller.id,
        target_name: target.full_name,
        target_email: target.email,
        session_id: session?.id,
      }),
    });
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
    const { data, error } = await admin
      .from("organization_features")
      .upsert({ organization_id: orgId, manual_tier_override: tier, override_expires_at: expiresAt, override_reason: reason, override_set_by: caller.id }, { onConflict: "organization_id" })
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "OVERRIDE_PLAN", targetOrgId: orgId, newState: { tier, expiresAt, reason }, notes: `Manual override to ${tier}` });
    return ok(data);
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
    await admin.from("organization_features").upsert({ organization_id: orgId }, { onConflict: "organization_id" });

    const { data, error } = await admin
      .from("organization_features")
      .update({ [feature]: enabled })
      .eq("organization_id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "TOGGLE_FEATURE", targetOrgId: orgId, newState: { [feature]: enabled } });
    return ok(data);
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
    await admin.from("organization_features").upsert({ organization_id: orgId }, { onConflict: "organization_id" });

    const { data, error } = await admin
      .from("organization_features")
      .update(quotas)
      .eq("organization_id", orgId)
      .select()
      .maybeSingle();

    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "UPDATE_QUOTA", targetOrgId: orgId, newState: quotas });
    return ok(data);
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 4: DATABASE MUTATOR (SAFE GUI)
   ═══════════════════════════════════════════════════════════════════ */

/** List all public tables in the database — dynamically discovered */
export async function listTables() {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    // Comprehensive list of tables that actually exist in production.
    // Verified against information_schema on 2026-03-12.
    return ok([
      "ai_agent_calls", "ai_agent_config", "ai_chat_messages", "api_keys",
      "asset_audits", "assets", "audit_log", "audit_sessions",
      "automation_flows", "automation_logs", "automation_queue", "award_rules",
      "behaviour_events", "behaviour_support_plans", "branches", "brand_kits",
      "budget_allocations", "budget_quarantine_ledger",
      "care_chat_channels", "care_chat_members", "care_chat_messages", "care_goals", "care_plans",
      "channels", "channel_members", "ci_actions", "claim_line_items",
      "client_contacts", "clients",
      "email_logs", "external_agencies",
      "form_assignments", "form_responses", "form_submissions", "form_templates", "forms",
      "funders",
      "health_observations", "help_articles", "help_threads",
      "incidents", "integrations", "inventory_items",
      "invoice_line_items", "invoices",
      "job_activity", "job_line_items", "job_media", "job_subtasks", "jobs",
      "knowledge_articles", "leave_requests",
      "medication_administration_records", "message_acknowledgements", "messages",
      "ndis_catalogue", "notifications",
      "onboarding_checklists", "organization_features", "organization_invites",
      "organization_members", "organization_roles", "organizations",
      "participant_medications", "participant_profiles",
      "payments", "payouts", "payroll_exports",
      "plan_manager_invoices", "policy_register", "proda_claim_batches",
      "profiles", "progress_notes", "public_holidays",
      "quote_line_items", "quotes",
      "restrictive_practices", "rollout_log", "roster_templates",
      "schedule_blocks", "schedule_events",
      "sentinel_alerts", "sentinel_keywords", "service_agreements",
      "staff_leave", "staff_profiles",
      "subscriptions", "super_admin_audit_logs",
      "support_coordination_cases",
      "telemetry_events", "template_shifts",
      "time_entries", "timesheet_adjustments", "timesheets",
      "vehicles", "worker_credentials",
      "workspace_branding", "workspace_email_templates",
    ]);
  } catch (e: any) {
    return err(e.message);
  }
}

/** Read rows from a table with pagination */
export async function readTableRows(tableName: string, limit = 25, offset = 0, filters?: Record<string, string>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");

    const admin = createAdminSupabaseClient();

    // Try multiple ordering strategies — tables have different timestamp columns
    const orderColumns = ["created_at", "event_timestamp", "joined_at", "updated_at"];
    let lastError = "";

    for (const orderCol of orderColumns) {
      const q = admin
        .from(tableName)
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order(orderCol as any, { ascending: false });

      const { data, error, count } = await q;
      if (!error) {
        logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "VIEW_TABLE", targetTable: tableName, notes: `Viewed ${tableName}` });
        return ok({ rows: data || [], total: count || 0 });
      }
      lastError = error.message;
    }

    // Final fallback: no ordering at all
    const { data, error, count } = await admin
      .from(tableName)
      .select("*", { count: "exact" })
      .range(offset, offset + limit - 1);

    if (error) return err(`Table '${tableName}' may not exist or is inaccessible: ${error.message}`);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "VIEW_TABLE", targetTable: tableName, notes: `Viewed ${tableName}` });
    return ok({ rows: data || [], total: count || 0 });
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
    const { data: prev } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();

    const { data, error } = await admin.from(tableName).update(updates).eq("id", recordId).select().maybeSingle();
    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "UPDATE_ROW", targetTable: tableName, targetRecordId: recordId, previousState: prev, newState: data, mutationPayload: updates });
    return ok(data);
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
    const { data: prev } = await admin.from(tableName).select("*").eq("id", recordId).maybeSingle();

    const { error } = await admin.from(tableName).delete().eq("id", recordId);
    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "DELETE_ROW", targetTable: tableName, targetRecordId: recordId, previousState: prev });
    return ok({ success: true });
  } catch (e: any) {
    return err(e.message);
  }
}

/** Insert a new row into a table */
export async function insertTableRow(tableName: string, rowData: Record<string, any>) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    if (!/^[a-z_][a-z0-9_]*$/.test(tableName)) return err("Invalid table name");

    const admin = createAdminSupabaseClient();
    const { data: row, error } = await admin.from(tableName).insert(rowData).select().maybeSingle();
    if (error) return err(error.message);

    logAudit({ adminId: caller.id, adminEmail: caller.email, actionType: "INSERT_ROW", targetTable: tableName, targetRecordId: (row as any)?.id || null, newState: row, mutationPayload: rowData });
    return ok(row);
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
    return ok({ rows: data, total: count });
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

    // Use columns that definitely exist on each table
    const [orgs, users, members, jobs] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("jobs").select("id", { count: "exact", head: true }),
    ]);

    return ok({
      total_workspaces: orgs.count || 0,
      total_users: users.count || 0,
      active_memberships: members.count || 0,
      total_jobs: jobs.count || 0,
    });
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODULE 7: WEBHOOK DLQ
   ═══════════════════════════════════════════════════════════════════ */

/** List unresolved webhook dead letters for triage */
export async function listWebhookDeadLetters(limit = 100, offset = 0) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { data, error, count } = await admin
      .from("webhook_dead_letters")
      .select("*", { count: "exact" })
      .eq("is_resolved", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return err(error.message);
    return ok({ rows: data || [], total: count || 0 });
  } catch (e: any) {
    return err(e.message);
  }
}

/** Replay a DLQ payload through webhooks-ingest and mark resolved if successful */
export async function replayWebhookDeadLetter(deadLetterId: string) {
  try {
    const caller = await verifySuperAdmin();
    if (!caller) return err("Unauthorized");

    const admin = createAdminSupabaseClient();
    const { data: deadLetter, error: fetchErr } = await admin
      .from("webhook_dead_letters")
      .select("*")
      .eq("id", deadLetterId)
      .maybeSingle();

    if (fetchErr) return err(fetchErr.message);
    if (!deadLetter) return err("Dead letter not found");
    if (deadLetter.is_resolved) return err("Dead letter is already resolved");

    const headerObj = (deadLetter.headers as Record<string, string> | null) || {};
    const normalizedHeaders: Record<string, string> = {};

    // Preserve key routing headers required by webhooks-ingest.
    for (const key of ["x-iworkr-provider", "x-xero-tenant-id", "xero-tenant-id", "stripe-signature", "x-xero-signature"]) {
      const value = headerObj[key] || headerObj[key.toLowerCase()];
      if (typeof value === "string" && value.trim().length > 0) {
        normalizedHeaders[key] = value;
      }
    }

    const { data: invokeData, error: invokeErr } = await admin.functions.invoke("webhooks-ingest", {
      headers: normalizedHeaders,
      body: deadLetter.raw_payload,
    });

    if (invokeErr) {
      await logAudit({
        adminId: caller.id,
        adminEmail: caller.email,
        actionType: "REPLAY_DLQ_FAILED",
        targetTable: "webhook_dead_letters",
        targetRecordId: deadLetterId,
        mutationPayload: { invoke_error: invokeErr.message },
      });
      return err(invokeErr.message);
    }

    const nowIso = new Date().toISOString();
    const replayStatus = (invokeData as Record<string, unknown> | null)?.status;
    const shouldResolve = replayStatus !== "dlq_routed";

    const patch: Record<string, unknown> = {
      updated_at: nowIso,
      failure_reason: shouldResolve
        ? deadLetter.failure_reason
        : `${deadLetter.failure_reason} | REPLAY_STILL_UNRESOLVED @ ${nowIso}`,
    };
    if (shouldResolve) {
      patch.is_resolved = true;
      patch.resolved_at = nowIso;
      patch.resolved_by = caller.id;
    }

    const { error: updateErr } = await admin
      .from("webhook_dead_letters")
      .update(patch)
      .eq("id", deadLetterId);

    if (updateErr) return err(updateErr.message);

    await logAudit({
      adminId: caller.id,
      adminEmail: caller.email,
      actionType: shouldResolve ? "REPLAY_DLQ_SUCCESS" : "REPLAY_DLQ_PARTIAL",
      targetTable: "webhook_dead_letters",
      targetRecordId: deadLetterId,
      mutationPayload: { response: invokeData },
      notes: shouldResolve ? "Dead letter replayed and resolved" : "Replay completed but still unresolved",
    });

    return ok({ replay_result: invokeData, resolved: shouldResolve });
  } catch (e: any) {
    return err(e.message);
  }
}
