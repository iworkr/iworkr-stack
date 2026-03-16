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

