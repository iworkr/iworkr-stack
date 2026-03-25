/**
 * @module Oracle Intake Server Actions
 * @status COMPLETE
 * @description Project Oracle-Intake: Upload, review, commit, and reject intake sessions.
 *   Handles PDF upload to Supabase Storage, triggers AI extraction Edge Function,
 *   and executes the transactional relational scatter on commit.
 * @exports uploadIntakeDocument, fetchIntakeSessions, fetchIntakeSession,
 *   commitIntakeSession, rejectIntakeSession, retryIntakeExtraction
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────── */

export interface IntakeSession {
  id: string;
  organization_id: string;
  uploaded_by: string | null;
  document_type: string;
  file_path: string;
  original_filename: string;
  file_size_bytes: number | null;
  mime_type: string;
  status: "UPLOADING" | "ANALYZING" | "PENDING_REVIEW" | "COMMITTED" | "REJECTED" | "FAILED";
  extracted_data: NdisExtractedData | null;
  confidence_score: number | null;
  validation_warnings: string[];
  error_log: string | null;
  ai_model_used: string | null;
  ai_processing_ms: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  committed_participant_id: string | null;
  committed_care_plan_id: string | null;
  committed_agreement_id: string | null;
  created_at: string;
  updated_at: string;
  uploader_name?: string;
  reviewer_name?: string;
}

export interface NdisExtractedData {
  participant_first_name: string;
  participant_last_name: string;
  ndis_number: string;
  date_of_birth?: string;
  plan_start_date: string;
  plan_end_date: string;
  primary_disability?: string;
  plan_management_type?: string;
  goals?: Array<{
    goal_text: string;
    support_category?: string;
  }>;
  budgets: Array<{
    category: string;
    subcategory?: string;
    total_amount: number;
    management_type?: string;
  }>;
  support_coordinator_name?: string;
  plan_manager_name?: string;
}

export interface IntakeStats {
  total: number;
  analyzing: number;
  pending_review: number;
  committed: number;
  rejected: number;
  failed: number;
  avg_confidence: number;
}

/* ── Helpers ──────────────────────────────────────────── */

async function getSupabase() {
  return (await createServerSupabaseClient()) as any;
}

/* ── Upload Document ──────────────────────────────────── */

export async function uploadIntakeDocument(
  orgId: string,
  formData: FormData,
): Promise<{ success: boolean; session_id?: string; error?: string }> {
  try {
    const supabase = await getSupabase();
    const file = formData.get("file") as File;

    if (!file) return { success: false, error: "No file provided" };

    if (file.type !== "application/pdf") {
      return { success: false, error: "Only PDF files are supported" };
    }

    if (file.size > 52428800) {
      return { success: false, error: "File exceeds 50MB limit" };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${orgId}/${timestamp}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("intake-documents")
      .upload(storagePath, file, {
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Create intake session with UPLOADING status
    const { data: session, error: insertError } = await supabase
      .from("intake_sessions")
      .insert({
        organization_id: orgId,
        uploaded_by: user.id,
        document_type: "NDIS_PLAN",
        file_path: storagePath,
        original_filename: file.name,
        file_size_bytes: file.size,
        mime_type: file.type,
        status: "UPLOADING",
      })
      .select("id")
      .single();

    if (insertError) {
      return { success: false, error: `DB insert failed: ${insertError.message}` };
    }

    // Fire Edge Function asynchronously (don't await — let it process in background)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    fetch(`${supabaseUrl}/functions/v1/oracle-pdf-intake`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: session.id,
        file_path: storagePath,
        preferred_model: "gemini",
      }),
    }).catch((err) => {
      console.error("[oracle-intake] Edge Function trigger failed:", err);
    });

    revalidatePath("/dashboard/intake");
    return { success: true, session_id: session.id };
  } catch (e: any) {
    console.error("[oracle-intake] uploadIntakeDocument failed:", e);
    return { success: false, error: e?.message || "Upload failed" };
  }
}

/* ── Fetch Sessions List ──────────────────────────────── */

export async function fetchIntakeSessions(
  orgId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ data: IntakeSession[]; total: number }> {
  try {
    const supabase = await getSupabase();

    let query = supabase
      .from("intake_sessions")
      .select(
        "*, profiles!intake_sessions_uploaded_by_fkey(full_name)",
        { count: "exact" },
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    else query = query.limit(options?.limit || 20);

    const { data, error, count } = await query;
    if (error) {
      console.error("[oracle-intake] fetchIntakeSessions:", error);
      return { data: [], total: 0 };
    }

    const sessions = (data || []).map((row: any) => ({
      ...row,
      validation_warnings: row.validation_warnings || [],
      uploader_name: row.profiles?.full_name || "Unknown",
    }));

    return { data: sessions, total: count || 0 };
  } catch (e: any) {
    console.error("[oracle-intake] fetchIntakeSessions failed:", e);
    return { data: [], total: 0 };
  }
}

/* ── Fetch Single Session ─────────────────────────────── */

export async function fetchIntakeSession(
  sessionId: string,
  orgId: string,
): Promise<IntakeSession | null> {
  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("intake_sessions")
      .select(
        "*, profiles!intake_sessions_uploaded_by_fkey(full_name)",
      )
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (error) {
      console.error("[oracle-intake] fetchIntakeSession:", error);
      return null;
    }
    if (!data) return null;

    return {
      ...data,
      validation_warnings: data.validation_warnings || [],
      uploader_name: data.profiles?.full_name || "Unknown",
    };
  } catch (e: any) {
    console.error("[oracle-intake] fetchIntakeSession failed:", e);
    return null;
  }
}

/* ── Commit Intake (Relational Scatter) ───────────────── */

export async function commitIntakeSession(
  sessionId: string,
  orgId: string,
  extractedData: NdisExtractedData,
  reviewNotes?: string,
): Promise<{
  success: boolean;
  participant_id?: string;
  care_plan_id?: string;
  agreement_id?: string;
  error?: string;
}> {
  try {
    const supabase = await getSupabase();

    // Get current user for audit trail
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Call the transactional RPC
    const { data: result, error } = await supabase.rpc("commit_intake_session", {
      p_session_id: sessionId,
      p_organization_id: orgId,
      p_reviewed_by: user.id,
      p_extracted_data: extractedData,
      p_review_notes: reviewNotes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!result?.success) {
      return { success: false, error: result?.error || "Commit RPC failed" };
    }

    revalidatePath("/dashboard/intake");
    revalidatePath("/dashboard/care/participants");

    return {
      success: true,
      participant_id: result.participant_id,
      care_plan_id: result.care_plan_id,
      agreement_id: result.agreement_id,
    };
  } catch (e: any) {
    console.error("[oracle-intake] commitIntakeSession failed:", e);
    return { success: false, error: e?.message || "Commit failed" };
  }
}

/* ── Reject Intake ────────────────────────────────────── */

export async function rejectIntakeSession(
  sessionId: string,
  orgId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const { error } = await supabase
      .from("intake_sessions")
      .update({
        status: "REJECTED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reason,
      })
      .eq("id", sessionId)
      .eq("organization_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/intake");
    return { success: true };
  } catch (e: any) {
    console.error("[oracle-intake] rejectIntakeSession failed:", e);
    return { success: false, error: e?.message || "Reject failed" };
  }
}

/* ── Retry Failed Extraction ──────────────────────────── */

export async function retryIntakeExtraction(
  sessionId: string,
  orgId: string,
  preferredModel?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getSupabase();

    // Verify session exists and is in a retryable state
    const { data: session } = await supabase
      .from("intake_sessions")
      .select("id, file_path, status")
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!session) return { success: false, error: "Session not found" };
    if (!["FAILED", "REJECTED"].includes(session.status)) {
      return { success: false, error: `Cannot retry session in ${session.status} state` };
    }

    // Reset status
    await supabase
      .from("intake_sessions")
      .update({
        status: "UPLOADING",
        error_log: null,
        extracted_data: null,
        confidence_score: null,
        validation_warnings: [],
      })
      .eq("id", sessionId);

    // Re-trigger Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    fetch(`${supabaseUrl}/functions/v1/oracle-pdf-intake`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session_id: sessionId,
        file_path: session.file_path,
        preferred_model: preferredModel || "gemini",
      }),
    }).catch((err) => {
      console.error("[oracle-intake] Retry trigger failed:", err);
    });

    revalidatePath("/dashboard/intake");
    return { success: true };
  } catch (e: any) {
    console.error("[oracle-intake] retryIntakeExtraction failed:", e);
    return { success: false, error: e?.message || "Retry failed" };
  }
}

/* ── Stats ────────────────────────────────────────────── */

export async function fetchIntakeStats(
  orgId: string,
): Promise<IntakeStats> {
  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from("intake_sessions")
      .select("status, confidence_score")
      .eq("organization_id", orgId);

    if (error || !data) {
      return { total: 0, analyzing: 0, pending_review: 0, committed: 0, rejected: 0, failed: 0, avg_confidence: 0 };
    }

    const stats: IntakeStats = {
      total: data.length,
      analyzing: data.filter((s: any) => s.status === "ANALYZING" || s.status === "UPLOADING").length,
      pending_review: data.filter((s: any) => s.status === "PENDING_REVIEW").length,
      committed: data.filter((s: any) => s.status === "COMMITTED").length,
      rejected: data.filter((s: any) => s.status === "REJECTED").length,
      failed: data.filter((s: any) => s.status === "FAILED").length,
      avg_confidence: 0,
    };

    const withConfidence = data.filter((s: any) => s.confidence_score != null);
    if (withConfidence.length > 0) {
      stats.avg_confidence = Math.round(
        withConfidence.reduce((sum: number, s: any) => sum + (s.confidence_score || 0), 0) /
          withConfidence.length
      );
    }

    return stats;
  } catch {
    return { total: 0, analyzing: 0, pending_review: 0, committed: 0, rejected: 0, failed: 0, avg_confidence: 0 };
  }
}

/* ── Get Signed URL for PDF Viewing ───────────────────── */

export async function getIntakeDocumentUrl(
  filePath: string,
): Promise<{ url: string | null; error?: string }> {
  try {
    const supabase = await getSupabase();

    const { data, error } = await supabase.storage
      .from("intake-documents")
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) return { url: null, error: error.message };
    return { url: data.signedUrl };
  } catch (e: any) {
    return { url: null, error: e?.message || "Failed to get URL" };
  }
}
