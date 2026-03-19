"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Unauthorized" };
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, user: null, error: "Not a member" };
  return { supabase, user, error: null };
}

/* ══════════════════════════════════════════════════════
   FRAMEWORK MANAGEMENT
   ══════════════════════════════════════════════════════ */

export async function getFrameworks(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("regulatory_frameworks")
    .select("*")
    .or(`workspace_id.eq.${orgId},workspace_id.is.null`)
    .order("created_at", { ascending: false });

  return { data: (data ?? []) as Record<string, unknown>[], error: dbErr?.message ?? null };
}

export async function createFramework(orgId: string, params: {
  title: string;
  version_code?: string;
  description?: string;
  sector?: string;
  effective_date: string;
  expiry_date?: string;
  is_global?: boolean;
}) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("regulatory_frameworks")
    .insert({
      workspace_id: params.is_global ? null : orgId,
      title: params.title,
      version_code: params.version_code ?? null,
      description: params.description ?? null,
      sector: params.sector ?? "both",
      effective_date: params.effective_date,
      expiry_date: params.expiry_date ?? null,
      status: "DRAFT",
      created_by: user.id,
    })
    .select("id")
    .single();

  revalidatePath("/dashboard/settings/compliance-engine");
  return { data: data as { id: string } | null, error: dbErr?.message ?? null };
}

export async function updateFrameworkStatus(orgId: string, frameworkId: string, status: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("regulatory_frameworks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", frameworkId);

  revalidatePath("/dashboard/settings/compliance-engine");
  return { error: dbErr?.message ?? null };
}

export async function deleteFramework(orgId: string, frameworkId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  await (supabase as SupabaseClient)
    .from("regulatory_frameworks")
    .delete()
    .eq("id", frameworkId);

  revalidatePath("/dashboard/settings/compliance-engine");
  return { error: null };
}

/* ── Ingestion ───────────────────────────────────────── */

export async function triggerIngestion(orgId: string, frameworkId: string, params: {
  storage_path?: string;
  raw_text?: string;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  if (params.storage_path) {
    await (supabase as SupabaseClient)
      .from("regulatory_frameworks")
      .update({
        source_pdf_url: params.storage_path,
        updated_at: new Date().toISOString(),
      })
      .eq("id", frameworkId);
  }

  const { error: fnErr } = await supabase.functions.invoke("ingest-regulation", {
    body: {
      framework_id: frameworkId,
      storage_path: params.storage_path,
      raw_text: params.raw_text,
    },
  });

  revalidatePath("/dashboard/settings/compliance-engine");
  return { error: fnErr?.message ?? null };
}

/* ══════════════════════════════════════════════════════
   COMPLIANCE EVALUATION
   ══════════════════════════════════════════════════════ */

export async function evaluateCompliance(orgId: string, params: {
  serialized_intent: string;
  context_type: string;
  context_id?: string;
  operation_date?: string;
  framework_id?: string;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data, error: fnErr } = await supabase.functions.invoke("regulatory-rag-intercept", {
    body: {
      organization_id: orgId,
      ...params,
    },
  });

  return { data: data as Record<string, unknown> | null, error: fnErr?.message ?? null };
}

/* ── Override a violation ────────────────────────────── */

export async function overrideViolation(orgId: string, logId: string, reason: string) {
  const { supabase, user, error } = await requireOrgMember(orgId);
  if (error || !user) return { error: error ?? "Unauthorized" };

  // Check compliance mode
  const { data: org } = await (supabase as SupabaseClient)
    .from("organizations")
    .select("compliance_mode")
    .eq("id", orgId)
    .maybeSingle();

  if ((org as Record<string, unknown>)?.compliance_mode === "HARD_STOP") {
    return { error: "Cannot override violations in HARD_STOP mode" };
  }

  const { error: dbErr } = await (supabase as SupabaseClient)
    .from("compliance_intercept_logs")
    .update({
      was_overridden: true,
      override_reason: reason,
      overridden_by: user.id,
      overridden_at: new Date().toISOString(),
    })
    .eq("id", logId)
    .eq("organization_id", orgId);

  return { error: dbErr?.message ?? null };
}

/* ══════════════════════════════════════════════════════
   COMPLIANCE SETTINGS
   ══════════════════════════════════════════════════════ */

export async function getComplianceSettings(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const { data } = await (supabase as SupabaseClient)
    .from("organizations")
    .select("compliance_mode, compliance_enabled")
    .eq("id", orgId)
    .maybeSingle();

  return { data: data as Record<string, unknown> | null, error: null };
}

export async function updateComplianceSettings(orgId: string, params: {
  compliance_mode?: string;
  compliance_enabled?: boolean;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { error };

  await (supabase as SupabaseClient)
    .from("organizations")
    .update(params)
    .eq("id", orgId);

  revalidatePath("/dashboard/settings/compliance-engine");
  return { error: null };
}

/* ══════════════════════════════════════════════════════
   AUDIT LOGS
   ══════════════════════════════════════════════════════ */

export async function getComplianceLogs(orgId: string, opts?: {
  result?: string;
  limit?: number;
}) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: [], error };

  let query = (supabase as SupabaseClient)
    .from("compliance_intercept_logs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (opts?.result) query = query.eq("result", opts.result);
  query = query.limit(opts?.limit ?? 50);

  const { data, error: dbErr } = await query;
  return { data: (data ?? []) as Record<string, unknown>[], error: dbErr?.message ?? null };
}

export async function getComplianceStats(orgId: string) {
  const { supabase, error } = await requireOrgMember(orgId);
  if (error) return { data: null, error };

  const [compliant, violations, overridden, total, frameworks] = await Promise.all([
    (supabase as SupabaseClient).from("compliance_intercept_logs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("result", "COMPLIANT"),
    (supabase as SupabaseClient).from("compliance_intercept_logs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("result", "VIOLATION_DETECTED"),
    (supabase as SupabaseClient).from("compliance_intercept_logs").select("id", { count: "exact" }).eq("organization_id", orgId).eq("was_overridden", true),
    (supabase as SupabaseClient).from("compliance_intercept_logs").select("id", { count: "exact" }).eq("organization_id", orgId),
    (supabase as SupabaseClient).from("regulatory_frameworks").select("id", { count: "exact" }).or(`workspace_id.eq.${orgId},workspace_id.is.null`).eq("status", "ACTIVE"),
  ]);

  return {
    data: {
      compliant: compliant.count ?? 0,
      violations: violations.count ?? 0,
      overridden: overridden.count ?? 0,
      total_evaluations: total.count ?? 0,
      active_frameworks: frameworks.count ?? 0,
    },
    error: null,
  };
}
