/**
 * @module GovernancePolicies Server Actions
 * @status COMPLETE
 * @description Policy lifecycle management — create, publish, version, acknowledge, and enforce organizational policies
 * @exports createPolicyAction, fetchPoliciesAction, publishPolicyAction, acknowledgePolicyAction, fetchComplianceMatrixAction
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PolicyCreateSchema = z.object({
  organization_id: z.string().uuid(),
  title: z.string().min(2).max(300),
  category: z.enum(["whs", "clinical", "hr", "general", "emergency", "governance", "safety", "operational", "finance", "privacy"]),
  target_audience_rules: z.record(z.string(), z.unknown()).default({ audience: "all" }),
  enforcement_level: z.number().int().min(1).max(3).default(2),
  grace_period_days: z.number().int().min(0).max(90).default(7),
});

const PublishPolicySchema = z.object({
  policy_id: z.string().uuid(),
  version_number: z.string().min(1).max(20),
  document_url: z.string().optional(),
  rich_text_content: z.string().optional(),
  quiz_template_id: z.string().uuid().optional(),
  quiz_payload: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correct_answer: z.string(),
  })).optional(),
});

const AckSchema = z.object({
  acknowledgement_id: z.string().uuid(),
  quiz_score: z.number().min(0).max(100).optional(),
  quiz_passed: z.boolean().default(false),
  signature_base64: z.string().optional(),
  biometric_token: z.string().optional(),
  device_info: z.string().optional(),
});

async function requireUser() {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function createPolicyAction(input: z.infer<typeof PolicyCreateSchema>) {
  const parsed = PolicyCreateSchema.parse(input);
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("policy_register")
    .insert({
      organization_id: parsed.organization_id,
      title: parsed.title,
      category: parsed.category,
      target_audience_rules: parsed.target_audience_rules,
      enforcement_level: parsed.enforcement_level,
      grace_period_days: parsed.grace_period_days,
      status: "draft",
      created_by: user.id,
      requires_acknowledgement: parsed.enforcement_level > 1,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/governance/policies");
  return data;
}

export async function publishPolicyVersionAction(input: z.infer<typeof PublishPolicySchema>) {
  const parsed = PublishPolicySchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: policy, error: pErr } = await supabase
    .from("policy_register")
    .select("id, organization_id, title")
    .eq("id", parsed.policy_id)
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: version, error } = await supabase
    .from("policy_versions")
    .insert({
      policy_id: parsed.policy_id,
      organization_id: policy.organization_id,
      version_number: parsed.version_number,
      document_url: parsed.document_url ?? null,
      rich_text_content: parsed.rich_text_content ?? null,
      quiz_template_id: parsed.quiz_template_id ?? null,
      quiz_payload: parsed.quiz_payload ?? [],
      published_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("policy_register")
    .update({
      version: parsed.version_number,
      status: "current",
      current_version_id: version.id,
      content: parsed.rich_text_content ?? null,
      document_url: parsed.document_url ?? null,
      effective_date: new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.policy_id);

  const { data: distribute, error: distErr } = await supabase.functions.invoke("distribute-policy", {
    body: { policy_version_id: version.id },
  });
  if (distErr) throw new Error(distErr.message);

  revalidatePath("/dashboard/governance/policies");
  revalidatePath("/dashboard/compliance/policies");
  return { version, distribution: distribute };
}

export async function listPoliciesAction(organizationId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("policy_register")
    .select("*, policy_versions(id, version_number, published_at)")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function listPolicyComplianceMatrixAction(organizationId: string) {
  const { supabase } = await requireUser();
  const [{ data: workers, error: wErr }, { data: policies, error: pErr }, { data: acknowledgements, error: aErr }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select("user_id, role, profiles(full_name, email)")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("created_at"),
      supabase
        .from("policy_register")
        .select("id, title, enforcement_level, current_version_id")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false }),
      supabase
        .from("policy_acknowledgements")
        .select("id, user_id, policy_id, policy_version_id, status, due_at, acknowledged_at")
        .eq("organization_id", organizationId),
    ]);
  if (wErr) throw new Error(wErr.message);
  if (pErr) throw new Error(pErr.message);
  if (aErr) throw new Error(aErr.message);

  const totalRequired = (workers || []).length * (policies || []).length;
  const signedCount = (acknowledgements || []).filter((x: any) => x.status === "signed").length;
  const compliancePercent = totalRequired > 0 ? (signedCount / totalRequired) * 100 : 0;

  return {
    workers: workers || [],
    policies: policies || [],
    acknowledgements: acknowledgements || [],
    compliance_percent: Number(compliancePercent.toFixed(2)),
    total_required: totalRequired,
    total_signed: signedCount,
  };
}

export async function listMyPendingPoliciesAction() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("policy_acknowledgements")
    .select("id, policy_id, policy_version_id, status, due_at, policy_register(title, enforcement_level), policy_versions(version_number, rich_text_content, document_url, quiz_payload)")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("due_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function acknowledgePolicyAction(input: z.infer<typeof AckSchema>) {
  const parsed = AckSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: ack, error: ackErr } = await supabase
    .from("policy_acknowledgements")
    .select("id, organization_id, user_id, policy_id, policy_version_id")
    .eq("id", parsed.acknowledgement_id)
    .single();
  if (ackErr) throw new Error(ackErr.message);
  if (ack.user_id !== user.id) throw new Error("Cannot sign another worker's acknowledgement.");

  let signaturePath: string | null = null;
  if (parsed.signature_base64) {
    const base64 = parsed.signature_base64.includes(",")
      ? parsed.signature_base64.split(",")[1]
      : parsed.signature_base64;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    signaturePath = `policy-signatures/${ack.organization_id}/${ack.policy_version_id}/${user.id}-${Date.now()}.png`;
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(signaturePath, bytes, { upsert: true, contentType: "image/png" });
    if (upErr) throw new Error(upErr.message);
  }

  const reqHeaders = await headers();
  const ip = (reqHeaders.get("x-forwarded-for") || "").split(",")[0]?.trim() || null;
  const { error } = await supabase
    .from("policy_acknowledgements")
    .update({
      status: "signed",
      acknowledged_at: new Date().toISOString(),
      quiz_passed: parsed.quiz_passed,
      quiz_score: parsed.quiz_score ?? null,
      biometric_token: parsed.biometric_token ?? null,
      ip_address: ip,
      device_info: parsed.device_info ?? null,
      signature_image_url: signaturePath,
    })
    .eq("id", parsed.acknowledgement_id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/compliance/policies");
  return { success: true };
}

export async function sendPolicyRemindersAction(input: { organization_id: string; policy_id: string }) {
  const { supabase } = await requireUser();
  const { data: pendingRows, error } = await supabase
    .from("policy_acknowledgements")
    .select("user_id, policy_register(title)")
    .eq("organization_id", input.organization_id)
    .eq("policy_id", input.policy_id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  const userIds = [...new Set((pendingRows || []).map((r: any) => r.user_id))];
  if (userIds.length === 0) return { reminded: 0 };

  const title = pendingRows?.[0]?.policy_register?.title || "Policy update";
  await supabase.functions.invoke("send-push", {
    body: {
      organization_id: input.organization_id,
      user_ids: userIds,
      title: "Policy acknowledgement reminder",
      body: `${title} is still pending your signature.`,
      data: { type: "policy_reminder", policy_id: input.policy_id },
    },
  });
  return { reminded: userIds.length };
}

export async function getPolicyDossierDataAction(input: { policy_id: string; organization_id: string }) {
  const { supabase } = await requireUser();
  const [{ data: policy, error: pErr }, { data: rows, error: rErr }] = await Promise.all([
    supabase
      .from("policy_register")
      .select("id, title, version, content, document_url, current_version_id, policy_versions(version_number, rich_text_content, document_url, published_at)")
      .eq("id", input.policy_id)
      .eq("organization_id", input.organization_id)
      .single(),
    supabase
      .from("policy_acknowledgements")
      .select("user_id, status, acknowledged_at, ip_address, signature_image_url, policy_version_id, profiles!policy_acknowledgements_user_id_fkey(full_name, email)")
      .eq("organization_id", input.organization_id)
      .eq("policy_id", input.policy_id)
      .order("acknowledged_at", { ascending: false }),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (rErr) throw new Error(rErr.message);
  return { policy, acknowledgements: rows || [] };
}

// ── Project Lexicon: Governance Dashboard Telemetry ───────────────────────────

export interface PolicyRow {
  id: string;
  title: string;
  category: string;
  version: string;
  status: string;
  document_url: string | null;
  review_date: string | null;
  effective_date: string | null;
  requires_acknowledgement: boolean;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
  ack_total: number;
  ack_signed: number;
}

export interface GovernanceTelemetry {
  total_active: number;
  upcoming_reviews: number;
  ack_rate: number;
  overdue_acks: number;
}

export async function getGovernanceDashboardAction(organizationId: string): Promise<{
  policies: PolicyRow[];
  telemetry: GovernanceTelemetry;
}> {
  const { supabase } = await requireUser();

  // Fetch all policies for the org (no is_active filter — use status field)
  const { data: rawPolicies, error: pErr } = await supabase
    .from("policy_register")
    .select("id, title, category, version, status, document_url, review_date, effective_date, requires_acknowledgement, current_version_id, created_at, updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (pErr) throw new Error(pErr.message);
  const policies = rawPolicies || [];

  // Fetch acknowledgement counts grouped by policy_id
  const policyIds = policies.map((p: any) => p.id);
  const ackMap: Record<string, { total: number; signed: number }> = {};

  if (policyIds.length > 0) {
    const { data: acks } = await supabase
      .from("policy_acknowledgements")
      .select("policy_id, status")
      .eq("organization_id", organizationId)
      .in("policy_id", policyIds);

    for (const ack of acks || []) {
      if (!ackMap[ack.policy_id]) ackMap[ack.policy_id] = { total: 0, signed: 0 };
      ackMap[ack.policy_id].total++;
      if (ack.status === "signed") ackMap[ack.policy_id].signed++;
    }
  }

  const enriched: PolicyRow[] = policies.map((p: any) => ({
    ...p,
    ack_total: ackMap[p.id]?.total ?? 0,
    ack_signed: ackMap[p.id]?.signed ?? 0,
  }));

  // Telemetry calculations
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const activeStatuses = ["active", "current", "published"];

  const totalActive = enriched.filter((p) => activeStatuses.includes(p.status?.toLowerCase() ?? "")).length;

  const upcomingReviews = enriched.filter((p) => {
    if (!p.review_date) return false;
    const rd = new Date(p.review_date);
    return rd >= now && rd <= in30Days;
  }).length;

  const allAckTotal  = enriched.reduce((s, p) => s + p.ack_total, 0);
  const allAckSigned = enriched.reduce((s, p) => s + p.ack_signed, 0);
  const ackRate      = allAckTotal > 0 ? Math.round((allAckSigned / allAckTotal) * 100) : 100;

  // Overdue: pending acks where due_at has passed
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { count: overdueCount } = await supabase
    .from("policy_acknowledgements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .lt("due_at", sevenDaysAgo.toISOString());

  return {
    policies: enriched,
    telemetry: {
      total_active: totalActive,
      upcoming_reviews: upcomingReviews,
      ack_rate: ackRate,
      overdue_acks: overdueCount ?? 0,
    },
  };
}

export async function publishPolicyWithFileAction(input: {
  organization_id: string;
  title: string;
  category: string;
  version_number: string;
  review_date: string;
  audience: "all" | "specific_roles" | "specific_workers";
  roles?: string[];
  file_base64?: string;
  file_name?: string;
  mime_type?: string;
}) {
  const { supabase, user } = await requireUser();

  let storagePath: string | null = null;

  // Upload PDF to Supabase Storage if provided
  if (input.file_base64 && input.file_name) {
    const safeName = input.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `${input.organization_id}/policies/${input.category}/${Date.now()}_${safeName}`;
    const bytes = Uint8Array.from(atob(input.file_base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, bytes, { upsert: true, contentType: input.mime_type ?? "application/pdf" });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
  }

  // Upsert policy_register
  const { data: policy, error: pErr } = await supabase
    .from("policy_register")
    .insert({
      organization_id: input.organization_id,
      title: input.title,
      category: input.category,
      version: input.version_number,
      status: "active",
      review_date: input.review_date,
      effective_date: new Date().toISOString().slice(0, 10),
      document_url: storagePath,
      target_audience_rules: { audience: input.audience, roles: input.roles ?? [] },
      enforcement_level: 2,
      grace_period_days: 7,
      requires_acknowledgement: true,
      created_by: user.id,
    })
    .select("id, organization_id, title")
    .single();
  if (pErr) throw new Error(pErr.message);

  // Create policy_versions row
  const { data: version, error: vErr } = await supabase
    .from("policy_versions")
    .insert({
      policy_id: policy.id,
      organization_id: input.organization_id,
      version_number: input.version_number,
      document_url: storagePath,
      published_by: user.id,
    })
    .select("id")
    .single();
  if (vErr) throw new Error(vErr.message);

  // Update policy with current_version_id
  await supabase
    .from("policy_register")
    .update({ current_version_id: version.id })
    .eq("id", policy.id);

  // Distribute acknowledgements
  try {
    await supabase.functions.invoke("distribute-policy", {
      body: { policy_version_id: version.id },
    });
  } catch {
    // Non-fatal — distribution failure doesn't block the publish
  }

  revalidatePath("/dashboard/governance/policies");
  return { policy_id: policy.id, version_id: version.id };
}

export async function nudgeUnreadStaffAction(input: { organization_id: string; policy_id: string; policy_title: string }) {
  const { supabase } = await requireUser();

  const { data: pendingRows, error } = await supabase
    .from("policy_acknowledgements")
    .select("user_id")
    .eq("organization_id", input.organization_id)
    .eq("policy_id", input.policy_id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);

  const userIds = [...new Set((pendingRows || []).map((r: any) => r.user_id))];
  if (userIds.length === 0) return { nudged: 0 };

  try {
    await (supabase as any).functions.invoke("dispatch-outbound", {
      body: {
        organization_id: input.organization_id,
        user_ids: userIds,
        title: "Policy signature required",
        body: `${input.policy_title} requires your acknowledgement. Please sign before your deadline.`,
        data: { type: "policy_nudge", policy_id: input.policy_id },
      },
    });
  } catch {
    // Fallback to legacy send-push function
    try {
      await (supabase as any).functions.invoke("send-push", {
        body: {
          organization_id: input.organization_id,
          user_ids: userIds,
          title: "Policy signature required",
          body: `${input.policy_title} requires your acknowledgement.`,
          data: { type: "policy_nudge", policy_id: input.policy_id },
        },
      });
    } catch {
      // Non-fatal
    }
  }

  return { nudged: userIds.length };
}

export async function getAuditTrackerAction(input: { organization_id: string; policy_id: string }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("policy_acknowledgements")
    .select("id, user_id, status, acknowledged_at, ip_address, policy_version, profiles!policy_acknowledgements_user_id_fkey(full_name, email)")
    .eq("organization_id", input.organization_id)
    .eq("policy_id", input.policy_id)
    .order("status", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

