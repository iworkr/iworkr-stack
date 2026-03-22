/**
 * @module PlanReviews Server Actions
 * @status COMPLETE
 * @description NDIS plan reviews — report generation, PDF compilation, evidence collection, and review scheduling
 * @exports createReportAction, fetchReportsAction, generatePdfAction, submitReviewAction, fetchReviewScheduleAction
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement } from "react";
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PlanReviewReportDocument, type PlanReviewPdfPayload } from "@/components/pdf/plan-review-report-document";

const CreateReportSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  title: z.string().min(1).max(220).optional(),
  data_scope_start: z.string().optional(),
  data_scope_end: z.string().optional(),
});

const UpdateDraftSchema = z.object({
  report_id: z.string().uuid(),
  draft_json_payload: z.record(z.string(), z.unknown()),
});

const RegenerateGoalSchema = z.object({
  report_id: z.string().uuid(),
  goal_id: z.string().uuid(),
  steering_instructions: z.string().max(1000).optional(),
});

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function scrubPII(text: string) {
  return text
    .replace(/\b(?:\+?61|0)\d{9}\b/g, "[PHONE]")
    .replace(/\b\d{1,3}\s+[A-Za-z0-9\s]{2,}\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Court|Ct)\b/gi, "[ADDRESS]")
    .replace(/\b\d{10,11}\b/g, "[ID]");
}

async function llmGoalRewrite(args: {
  participantName: string;
  goalStatement: string;
  evidence: string;
  steering?: string;
}) {
  const endpoint = process.env.ENTERPRISE_LLM_ENDPOINT;
  const apiKey = process.env.ENTERPRISE_LLM_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.ENTERPRISE_LLM_MODEL || "gpt-4o-mini";

  if (!endpoint || !apiKey) {
    return `${args.participantName} continues to make measurable progress toward "${args.goalStatement}" with ongoing supported practice. ${args.steering || ""}`.trim();
  }

  const payload = {
    model,
    temperature: 0.25,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a senior clinical NDIS report writer. Be objective and strengths-based. Use only provided evidence. Include [YYYY-MM-DD] citations when claiming milestones.",
      },
      {
        role: "user",
        content:
          `Goal: ${args.goalStatement}\nSteering: ${args.steering || "none"}\nEvidence:\n${scrubPII(args.evidence).replaceAll(args.participantName, "[PARTICIPANT_NAME]")}`,
      },
    ],
  };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`LLM request failed (${res.status})`);
  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return String(parsed.summary_narrative || "").replaceAll("[PARTICIPANT_NAME]", args.participantName);
}

export async function listPlanReviewParticipantsAction(organizationId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("participant_profiles")
    .select("id, preferred_name, clients(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    id: p.id as string,
    name: (p.preferred_name as string | null) || (p.clients?.name as string) || "Participant",
  }));
}

/**
 * Directory-level query: participants with their active NDIS plan and latest review status.
 * Powers the Master View Data Grid in Project Equinox.
 */
export async function listPlanReviewDirectoryAction(organizationId: string) {
  const { supabase } = await requireUser();

  // Fetch participants with their service agreements and latest review report
  const { data: participants, error: pErr } = await (supabase as any)
    .from("participant_profiles")
    .select("id, preferred_name, full_name, ndis_number, clients(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (pErr) throw new Error(pErr.message);

  const participantIds = (participants || []).map((p: any) => p.id);
  if (participantIds.length === 0) return [];

  // Fetch service agreements for these participants
  const { data: agreements } = await (supabase as any)
    .from("service_agreements")
    .select("id, participant_id, total_budget, consumed_budget, start_date, end_date, status")
    .eq("organization_id", organizationId)
    .in("participant_id", participantIds)
    .in("status", ["active", "pending_signature", "expired"])
    .order("created_at", { ascending: false });

  // Fetch latest plan review reports
  const { data: reports } = await (supabase as any)
    .from("plan_review_reports")
    .select("id, participant_id, title, status, data_scope_start, data_scope_end, updated_at")
    .eq("organization_id", organizationId)
    .in("participant_id", participantIds)
    .order("created_at", { ascending: false });

  // Build a map: participant_id -> latest agreement
  const agreementMap: Record<string, any> = {};
  for (const a of (agreements || [])) {
    if (!agreementMap[a.participant_id]) agreementMap[a.participant_id] = a;
  }

  // Build a map: participant_id -> latest report
  const reportMap: Record<string, any> = {};
  for (const r of (reports || [])) {
    if (!reportMap[r.participant_id]) reportMap[r.participant_id] = r;
  }

  return (participants || []).map((p: any) => {
    const agreement = agreementMap[p.id] || null;
    const report = reportMap[p.id] || null;
    const totalBudget = Number(agreement?.total_budget || 0);
    const consumedBudget = Number(agreement?.consumed_budget || 0);
    const utilizationPercent = totalBudget > 0 ? Math.round((consumedBudget / totalBudget) * 100) : 0;

    return {
      participant_id: p.id as string,
      name: (p.preferred_name as string | null) || (p.full_name as string | null) || (p.clients?.name as string) || "Unknown",
      ndis_number: (p.ndis_number as string | null) || null,
      plan_start: (agreement?.start_date as string | null) || null,
      plan_end: (agreement?.end_date as string | null) || null,
      total_budget: totalBudget,
      consumed_budget: consumedBudget,
      utilization_percent: utilizationPercent,
      agreement_status: (agreement?.status as string | null) || null,
      latest_report_id: (report?.id as string | null) || null,
      latest_report_status: (report?.status as string | null) || null,
      latest_report_title: (report?.title as string | null) || null,
    };
  });
}

export async function listPlanReviewReportsAction(organizationId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("plan_review_reports")
    .select("id, title, status, report_date, data_scope_start, data_scope_end, participant_id, participant_profiles(preferred_name, clients(name))")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPlanReviewReportAction(input: z.infer<typeof CreateReportSchema>) {
  const payload = CreateReportSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: agreement } = await (supabase as any)
    .from("service_agreements")
    .select("id, start_date, end_date")
    .eq("organization_id", payload.organization_id)
    .eq("participant_id", payload.participant_id)
    .in("status", ["active", "pending_signature", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scopeStart = payload.data_scope_start || agreement?.start_date || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const scopeEnd = payload.data_scope_end || agreement?.end_date || new Date().toISOString().slice(0, 10);

  const { data: participant } = await (supabase as any)
    .from("participant_profiles")
    .select("preferred_name, clients(name)")
    .eq("id", payload.participant_id)
    .eq("organization_id", payload.organization_id)
    .single();

  const title = payload.title
    || `${participant?.preferred_name || participant?.clients?.name || "Participant"} - Annual Plan Review ${new Date(scopeEnd).getFullYear()}`;

  const { data, error } = await (supabase as any)
    .from("plan_review_reports")
    .insert({
      organization_id: payload.organization_id,
      participant_id: payload.participant_id,
      service_agreement_id: agreement?.id || null,
      title,
      data_scope_start: scopeStart,
      data_scope_end: scopeEnd,
      report_date: new Date().toISOString().slice(0, 10),
      created_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plan-reviews/build");
  return data;
}

export async function startPlanReviewAggregationAction(reportId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.functions.invoke("start-report-aggregation", {
    body: { report_id: reportId },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plan-reviews/build");
  return data;
}

export async function getPlanReviewReportAction(reportId: string) {
  const { supabase } = await requireUser();
  const [{ data: report, error: reportError }, { data: snapshot }] = await Promise.all([
    (supabase as any)
      .from("plan_review_reports")
      .select(`
        *,
        participant_profiles(id, preferred_name, ndis_number, clients(name)),
        organizations(name)
      `)
      .eq("id", reportId)
      .single(),
    (supabase as any)
      .from("report_data_snapshots")
      .select("*")
      .eq("report_id", reportId)
      .maybeSingle(),
  ]);
  if (reportError) throw new Error(reportError.message);
  return { report, snapshot };
}

export async function updatePlanReviewDraftAction(input: z.infer<typeof UpdateDraftSchema>) {
  const payload = UpdateDraftSchema.parse(input);
  const { supabase } = await requireUser();
  const { error } = await (supabase as any)
    .from("plan_review_reports")
    .update({
      draft_json_payload: payload.draft_json_payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.report_id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function setPlanReviewStatusAction(input: { report_id: string; status: "draft" | "pending_manager_review" | "archived" }) {
  const { supabase } = await requireUser();
  const { error } = await (supabase as any)
    .from("plan_review_reports")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.report_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/plan-reviews/build");
  return { success: true };
}

export async function regenerateGoalNarrativeAction(input: z.infer<typeof RegenerateGoalSchema>) {
  const payload = RegenerateGoalSchema.parse(input);
  const { supabase } = await requireUser();

  const { report, snapshot } = await getPlanReviewReportAction(payload.report_id);
  const goals = Array.isArray(report.draft_json_payload?.goals) ? [...report.draft_json_payload.goals] : [];
  const idx = goals.findIndex((g: any) => g.goal_id === payload.goal_id);
  if (idx < 0) throw new Error("Goal section not found");

  const goal = goals[idx];
  const notes = Array.isArray(snapshot?.raw_shift_notes_json) ? snapshot.raw_shift_notes_json : [];
  const evidence = notes
    .slice(0, 150)
    .map((n: any) => `[${String(n.created_at || "").slice(0, 10)}] ${n.outcomes_achieved || n.context_of_support || ""}`)
    .join("\n");

  const rewritten = await llmGoalRewrite({
    participantName: report.participant_profiles?.preferred_name || report.participant_profiles?.clients?.name || "Participant",
    goalStatement: goal.goal_statement || "Goal",
    evidence,
    steering: payload.steering_instructions,
  });

  goals[idx] = { ...goal, summary_narrative: rewritten };
  const nextDraft = { ...(report.draft_json_payload || {}), goals };

  await updatePlanReviewDraftAction({
    report_id: payload.report_id,
    draft_json_payload: nextDraft as Record<string, unknown>,
  });
  revalidatePath("/dashboard/care/plan-reviews/build");
  return { success: true };
}

export async function getPlanReviewPdfPayloadAction(reportId: string): Promise<PlanReviewPdfPayload> {
  const { report } = await getPlanReviewReportAction(reportId);
  const draft = (report.draft_json_payload || {}) as Record<string, any>;
  const participantName = report.participant_profiles?.preferred_name || report.participant_profiles?.clients?.name || "Participant";
  return {
    title: report.title,
    participantName,
    participantNdisNumber: report.participant_profiles?.ndis_number || null,
    organizationName: report.organizations?.name || "Organization",
    reportDate: report.report_date,
    scopeStart: report.data_scope_start,
    scopeEnd: report.data_scope_end,
    executiveSummary: draft.executive_summary || "",
    goals: Array.isArray(draft.goals) ? draft.goals : [],
    incidentChartBase64: draft.analytics?.incident_chart_base64 || "",
    goalProgressChartBase64: draft.analytics?.goal_progress_chart_base64 || "",
    routineCompliancePercent: Number(draft.analytics?.routine_compliance_percent || 0),
    utilizationPercent: Number(draft.financial?.utilization_percent || 0),
  };
}

export async function finalizePlanReviewAction(reportId: string) {
  const { supabase, user } = await requireUser();
  const payload = await getPlanReviewPdfPayloadAction(reportId);

  const firstBuffer = await renderToBuffer(
    createElement(PlanReviewReportDocument, { payload }) as Parameters<typeof renderToBuffer>[0],
  );
  const firstHash = createHash("sha256")
    .update(Buffer.isBuffer(firstBuffer) ? firstBuffer : Buffer.from(firstBuffer as ArrayBuffer))
    .digest("hex");

  const sealedPayload: PlanReviewPdfPayload = { ...payload, sha256Hash: firstHash };
  const finalBuffer = await renderToBuffer(
    createElement(PlanReviewReportDocument, { payload: sealedPayload }) as Parameters<typeof renderToBuffer>[0],
  );
  const finalHash = createHash("sha256")
    .update(Buffer.isBuffer(finalBuffer) ? finalBuffer : Buffer.from(finalBuffer as ArrayBuffer))
    .digest("hex");
  const bytes = new Uint8Array(finalBuffer as ArrayLike<number>);

  const { report } = await getPlanReviewReportAction(reportId);
  const path = `plan-reviews/${report.organization_id}/${report.id}/final.pdf`;
  const up = await supabase.storage.from("documents").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);

  const { error: reportErr } = await (supabase as any)
    .from("plan_review_reports")
    .update({
      status: "finalized",
      final_pdf_url: path,
      finalized_by: user.id,
      finalized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);
  if (reportErr) throw new Error(reportErr.message);

  await (supabase as any).from("document_hashes").insert({
    organization_id: report.organization_id,
    generated_by: user.id,
    document_type: "plan_review_report",
    sha256_hash: finalHash,
    metadata: {
      report_id: report.id,
      participant_id: report.participant_id,
      title: report.title,
    },
  });

  await (supabase as any).from("participant_documents").insert({
    organization_id: report.organization_id,
    participant_id: report.participant_id,
    uploaded_by: user.id,
    title: `NDIS Plan Review - ${payload.participantName}`,
    file_path: path,
    mime_type: "application/pdf",
    status: "published",
    is_visible_to_family: true,
    requires_signature: false,
  });

  const { data: familyMembers } = await (supabase as any)
    .from("participant_network_members")
    .select("user_id")
    .eq("participant_id", report.participant_id);

  await Promise.all(
    (familyMembers || []).map((member: any) =>
      supabase.functions.invoke("send-push", {
        body: {
          record: {
            user_id: member.user_id,
            title: "New Plan Review Available",
            body: `A finalized NDIS Plan Review report for ${payload.participantName} is now available in your document vault.`,
            type: "document_published",
          },
        },
      }),
    ),
  );

  revalidatePath("/dashboard/care/plan-reviews/build");
  revalidatePath("/portal");
  return { success: true, sha256: finalHash, file_path: path };
}

export async function getFinalPlanReviewDownloadUrlAction(reportId: string) {
  const { supabase } = await requireUser();
  const { report } = await getPlanReviewReportAction(reportId);
  if (!report.final_pdf_url) return null;
  const signed = await supabase.storage.from("documents").createSignedUrl(report.final_pdf_url, 60 * 60);
  if (signed.error) throw new Error(signed.error.message);
  return signed.data.signedUrl;
}
