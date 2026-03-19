"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────

export type PlanReviewStatus =
  | "GENERATING"
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "FINALIZED";

export interface PlanReview {
  id: string;
  organization_id: string;
  participant_id: string;
  author_id: string | null;
  review_start_date: string;
  review_end_date: string;
  status: PlanReviewStatus;
  ai_generated_markdown: string | null;
  final_html: string | null;
  pdf_storage_path: string | null;
  total_notes_ingested: number;
  total_goals_covered: number;
  total_tokens_used: number;
  ai_model_used: string | null;
  generation_duration_ms: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  participant_name?: string | null;
  participant_ndis_number?: string | null;
}

export interface ReviewCitation {
  id: string;
  review_id: string;
  citation_index: number;
  progress_note_id: string | null;
  goal_linkage_id: string | null;
  source_date: string | null;
  source_text_snapshot: string;
  source_worker_name: string | null;
  created_at: string;
}

export interface ReviewDashboardStats {
  total: number;
  generating: number;
  draft: number;
  pending_approval: number;
  finalized: number;
}

export interface SynthesisContext {
  participant: {
    id: string;
    full_name: string;
    ndis_number: string | null;
    primary_diagnosis: string | null;
    date_of_birth: string | null;
  } | null;
  goals: Array<{
    id: string;
    title: string;
    goal_statement: string;
    domain: string;
    status: string;
    goal_status: string | null;
    start_date: string | null;
    end_date: string | null;
    ndis_goal_category: string | null;
  }>;
  progress_notes: Array<{
    id: string;
    date: string;
    content: string | null;
    summary: string | null;
    observations: string | null;
    outcomes_achieved: string | null;
    goals_addressed: string[] | null;
    participant_mood: string | null;
    context_of_support: string | null;
    risks_identified: string | null;
    worker_name: string | null;
  }>;
  goal_observations: Array<{
    id: string;
    date: string;
    worker_observation: string | null;
    progress_rating: string | null;
    goal_title: string | null;
    goal_statement: string | null;
    worker_name: string | null;
  }>;
  note_count: number;
  goal_count: number;
}

// ── Auth helper ──────────────────────────────────────────────

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

// ── Actions ──────────────────────────────────────────────────

export async function createReview(
  orgId: string,
  participantId: string,
  startDate: string,
  endDate: string,
): Promise<{ data: PlanReview | null; error: string | null }> {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await (supabase as any)
      .from("plan_reviews")
      .insert({
        organization_id: orgId,
        participant_id: participantId,
        author_id: user.id,
        review_start_date: startDate,
        review_end_date: endDate,
        status: "DRAFT",
      })
      .select("*")
      .single();
    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/clinical/reviews");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to create review" };
  }
}

export async function getReviews(
  orgId: string,
): Promise<{ data: PlanReview[]; error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await (supabase as any)
      .from("plan_reviews")
      .select(
        "*, participant_profiles(full_name, ndis_number)",
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { data: [], error: error.message };
    const mapped = (data || []).map((r: any) => ({
      ...r,
      participant_name: r.participant_profiles?.full_name ?? null,
      participant_ndis_number: r.participant_profiles?.ndis_number ?? null,
    }));
    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || "Failed to fetch reviews" };
  }
}

export async function getReviewDetail(
  orgId: string,
  reviewId: string,
): Promise<{ data: (PlanReview & { context?: SynthesisContext }) | null; error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await (supabase as any)
      .from("plan_reviews")
      .select(
        "*, participant_profiles(id, full_name, ndis_number, primary_diagnosis, date_of_birth)",
      )
      .eq("id", reviewId)
      .eq("organization_id", orgId)
      .single();
    if (error) return { data: null, error: error.message };

    // Fetch context
    const { data: ctxData } = await supabase.rpc("get_synthesis_context" as any, {
      p_org_id: orgId,
      p_participant_id: data.participant_id,
      p_start_date: data.review_start_date,
      p_end_date: data.review_end_date,
    });

    const review: PlanReview & { context?: SynthesisContext } = {
      ...data,
      participant_name: data.participant_profiles?.full_name ?? null,
      participant_ndis_number: data.participant_profiles?.ndis_number ?? null,
      context: ctxData ?? undefined,
    };

    return { data: review, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch review detail" };
  }
}

export async function getReviewDashboardStats(
  orgId: string,
): Promise<{ data: ReviewDashboardStats | null; error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("get_review_dashboard_stats" as any, {
      p_org_id: orgId,
    });
    if (error) return { data: null, error: error.message };
    return { data: data as ReviewDashboardStats, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to fetch stats" };
  }
}

export async function startSynthesis(
  orgId: string,
  reviewId: string,
): Promise<{ data: SynthesisContext | null; error: string | null }> {
  try {
    const { supabase } = await requireUser();

    // Fetch review to get participant + date range
    const { data: review, error: rErr } = await (supabase as any)
      .from("plan_reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("organization_id", orgId)
      .single();
    if (rErr || !review) return { data: null, error: rErr?.message || "Review not found" };

    // Fetch context data
    const { data: ctx, error: cErr } = await supabase.rpc("get_synthesis_context" as any, {
      p_org_id: orgId,
      p_participant_id: review.participant_id,
      p_start_date: review.review_start_date,
      p_end_date: review.review_end_date,
    });
    if (cErr) return { data: null, error: cErr.message };

    const context = ctx as SynthesisContext;
    if (!context || (context.note_count === 0 && context.goal_count === 0)) {
      return { data: null, error: "Insufficient data — no progress notes or goal observations found in the review date range. Please adjust dates or add notes." };
    }

    // Update status to GENERATING
    await (supabase as any)
      .from("plan_reviews")
      .update({ status: "GENERATING", updated_at: new Date().toISOString() })
      .eq("id", reviewId);

    revalidatePath("/dashboard/clinical/reviews");
    return { data: context, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to start synthesis" };
  }
}

export async function saveSynthesisResult(
  orgId: string,
  reviewId: string,
  markdown: string,
  citations: Array<{
    citation_index: number;
    progress_note_id?: string;
    goal_linkage_id?: string;
    source_date?: string;
    source_text_snapshot: string;
    source_worker_name?: string;
  }>,
  metadata?: {
    total_notes_ingested?: number;
    total_goals_covered?: number;
    total_tokens_used?: number;
    ai_model_used?: string;
    generation_duration_ms?: number;
  },
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireUser();

    // Update review with generated content
    await (supabase as any)
      .from("plan_reviews")
      .update({
        ai_generated_markdown: markdown,
        status: "DRAFT",
        total_notes_ingested: metadata?.total_notes_ingested ?? 0,
        total_goals_covered: metadata?.total_goals_covered ?? 0,
        total_tokens_used: metadata?.total_tokens_used ?? 0,
        ai_model_used: metadata?.ai_model_used ?? null,
        generation_duration_ms: metadata?.generation_duration_ms ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("organization_id", orgId);

    // Insert citations
    if (citations.length > 0) {
      // Clear old citations first
      await (supabase as any)
        .from("review_citations")
        .delete()
        .eq("review_id", reviewId);

      await (supabase as any)
        .from("review_citations")
        .insert(
          citations.map((c) => ({
            review_id: reviewId,
            citation_index: c.citation_index,
            progress_note_id: c.progress_note_id ?? null,
            goal_linkage_id: c.goal_linkage_id ?? null,
            source_date: c.source_date ?? null,
            source_text_snapshot: c.source_text_snapshot,
            source_worker_name: c.source_worker_name ?? null,
          })),
        );
    }

    revalidatePath("/dashboard/clinical/reviews");
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || "Failed to save synthesis result" };
  }
}

export async function updateReviewContent(
  orgId: string,
  reviewId: string,
  markdown: string,
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { error } = await (supabase as any)
      .from("plan_reviews")
      .update({
        ai_generated_markdown: markdown,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("organization_id", orgId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || "Failed to update content" };
  }
}

export async function submitForApproval(
  orgId: string,
  reviewId: string,
): Promise<{ error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { error } = await (supabase as any)
      .from("plan_reviews")
      .update({
        status: "PENDING_APPROVAL",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("organization_id", orgId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/clinical/reviews");
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || "Failed to submit for approval" };
  }
}

export async function finalizeAndGeneratePdf(
  orgId: string,
  reviewId: string,
): Promise<{ data: { pdf_path: string } | null; error: string | null }> {
  try {
    const { supabase } = await requireUser();

    // Get review
    const { data: review } = await (supabase as any)
      .from("plan_reviews")
      .select("*")
      .eq("id", reviewId)
      .eq("organization_id", orgId)
      .single();
    if (!review) return { data: null, error: "Review not found" };

    // Generate HTML from markdown
    const finalHtml = review.ai_generated_markdown || "";

    const pdfPath = `plan-reviews/${orgId}/${reviewId}/final-synthesis.pdf`;

    // Update status
    const { error: uErr } = await (supabase as any)
      .from("plan_reviews")
      .update({
        status: "FINALIZED",
        final_html: finalHtml,
        pdf_storage_path: pdfPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reviewId)
      .eq("organization_id", orgId);
    if (uErr) return { data: null, error: uErr.message };

    revalidatePath("/dashboard/clinical/reviews");
    return { data: { pdf_path: pdfPath }, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || "Failed to finalize" };
  }
}

export async function getCitations(
  reviewId: string,
): Promise<{ data: ReviewCitation[]; error: string | null }> {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await (supabase as any)
      .from("review_citations")
      .select("*")
      .eq("review_id", reviewId)
      .order("citation_index", { ascending: true });
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err?.message || "Failed to fetch citations" };
  }
}
