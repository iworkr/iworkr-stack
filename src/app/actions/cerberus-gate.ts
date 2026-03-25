/**
 * @module Cerberus-Gate Server Actions
 * @status COMPLETE
 * @description Dynamic compliance rules engine — CRUD, override PIN generation, stats
 * @exports fetchComplianceRulesAction, createComplianceRuleAction, generateOverridePinAction, fetchOverridesAction
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ComplianceRule {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trigger_state: "PRE_START" | "POST_COMPLETION";
  rule_type: string;
  config_jsonb: Record<string, any>;
  target_entity_type: string;
  target_entity_id: string | null;
  target_label: string | null;
  is_hard_block: boolean;
  is_active: boolean;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export interface ComplianceOverride {
  id: string;
  organization_id: string;
  rule_id: string;
  worker_id: string;
  job_id: string | null;
  shift_id: string | null;
  override_type: string;
  justification: string;
  authorized_by_admin_id: string | null;
  pin_id: string | null;
  created_at: string;
  worker_name?: string;
  rule_name?: string;
  job_title?: string;
  admin_name?: string;
}

export interface ComplianceStats {
  total_rules: number;
  pre_start_rules: number;
  post_completion_rules: number;
  hard_blocks: number;
  overrides_7d: number;
  overrides_30d: number;
}

// ── Fetch Rules ──────────────────────────────────────────────────────────────

export async function fetchComplianceRulesAction(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { data, error } = await sb
    .from("compliance_rules")
    .select("*, creator:profiles!created_by(full_name)")
    .eq("organization_id", orgId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cerberus-gate] fetchRules:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    ...r,
    creator_name: r.creator?.full_name || null,
  })) as ComplianceRule[];
}

// ── Create Rule ──────────────────────────────────────────────────────────────

export async function createComplianceRuleAction(
  orgId: string,
  rule: {
    name: string;
    description?: string;
    trigger_state: "PRE_START" | "POST_COMPLETION";
    rule_type: string;
    config_jsonb: Record<string, any>;
    target_entity_type: string;
    target_entity_id?: string;
    target_label?: string;
    is_hard_block: boolean;
    priority?: number;
  },
) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await sb.from("compliance_rules").insert({
    organization_id: orgId,
    ...rule,
    created_by: user?.id,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/compliance-rules");
  return { success: true };
}

// ── Update Rule ──────────────────────────────────────────────────────────────

export async function updateComplianceRuleAction(
  ruleId: string,
  updates: Partial<ComplianceRule>,
) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { error } = await sb
    .from("compliance_rules")
    .update(updates as any)
    .eq("id", ruleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/compliance-rules");
  return { success: true };
}

// ── Delete Rule ──────────────────────────────────────────────────────────────

export async function deleteComplianceRuleAction(ruleId: string) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { error } = await sb
    .from("compliance_rules")
    .delete()
    .eq("id", ruleId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/compliance-rules");
  return { success: true };
}

// ── Toggle Rule Active ───────────────────────────────────────────────────────

export async function toggleComplianceRuleAction(
  ruleId: string,
  isActive: boolean,
) {
  return updateComplianceRuleAction(ruleId, { is_active: isActive } as any);
}

// ── Generate Override PIN ────────────────────────────────────────────────────

export async function generateOverridePinAction(
  orgId: string,
  jobId: string,
  ttlMinutes = 5,
) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const pin = String(Math.floor(100000 + Math.random() * 900000));

  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const { data: pinId, error } = await sb.rpc("generate_override_pin", {
    p_organization_id: orgId,
    p_job_id: jobId,
    p_pin_hash: pinHash,
    p_ttl_minutes: ttlMinutes,
  });

  if (error) {
    console.error("[cerberus-gate] generatePin:", error);
    return { error: error.message };
  }

  return {
    pin,
    pin_id: pinId,
    expires_in_minutes: ttlMinutes,
  };
}

// ── Fetch Overrides ──────────────────────────────────────────────────────────

export async function fetchOverridesAction(
  orgId: string,
  limit = 50,
) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { data, error } = await sb
    .from("compliance_overrides")
    .select(
      [
        "*",
        "worker:profiles!worker_id(full_name)",
        "rule:compliance_rules!rule_id(name)",
        "job:jobs!job_id(title)",
        "admin:profiles!authorized_by_admin_id(full_name)",
      ].join(", "),
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[cerberus-gate] fetchOverrides:", error);
    return [];
  }

  return (data || []).map((r: any) => ({
    ...r,
    worker_name: r.worker?.full_name || "Unknown",
    rule_name: r.rule?.name || "Unknown Rule",
    job_title: r.job?.title || "Unknown Job",
    admin_name: r.admin?.full_name || null,
  })) as ComplianceOverride[];
}

// ── Compliance Stats ─────────────────────────────────────────────────────────

export async function fetchComplianceStatsAction(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const sb = supabase as any;

  const { data, error } = await sb.rpc("get_compliance_stats", {
    p_organization_id: orgId,
  });

  if (error) {
    console.error("[cerberus-gate] fetchStats:", error);
    return {
      total_rules: 0,
      pre_start_rules: 0,
      post_completion_rules: 0,
      hard_blocks: 0,
      overrides_7d: 0,
      overrides_30d: 0,
    };
  }

  return data as ComplianceStats;
}
