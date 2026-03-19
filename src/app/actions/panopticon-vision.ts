/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Auth Helper ────────────────────────────────────── */

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ── Types ───────────────────────────────────────────── */

export interface EvidenceItem {
  id: string;
  job_id: string;
  worker_id: string;
  original_path: string;
  annotated_path: string | null;
  thumbnail_path: string | null;
  ai_tags: string[];
  ai_confidence: Record<string, number>;
  manual_caption: string | null;
  manual_tags: string[];
  location_lat: number | null;
  location_lng: number | null;
  is_client_visible: boolean;
  is_defect: boolean;
  face_detected: boolean;
  face_obfuscated: boolean;
  watermark_data: Record<string, any>;
  captured_at: string;
  // Joined fields
  job_display_id?: string;
  job_title?: string;
}

export interface EvidenceStats {
  total: number;
  annotated: number;
  defects: number;
  client_visible: number;
  face_detected: number;
  with_captions: number;
  unique_tags: string[];
}

/* ── 1. Get Job Evidence ─────────────────────────────── */

export async function getJobEvidence(orgId: string, jobId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("job_evidence")
      .select("*")
      .eq("job_id", jobId)
      .order("captured_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data as EvidenceItem[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch job evidence" };
  }
}

/* ── 2. Search Evidence by Tag ───────────────────────── */

export async function searchEvidence(
  orgId: string,
  searchTerm: string,
  options?: { jobId?: string; defectsOnly?: boolean; limit?: number; offset?: number }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("search_evidence_by_tag", {
      p_workspace_id: orgId,
      p_search_term: searchTerm,
      p_job_id: options?.jobId ?? null,
      p_defects_only: options?.defectsOnly ?? false,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    });

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as EvidenceItem[], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to search evidence" };
  }
}

/* ── 3. Get Evidence Stats ───────────────────────────── */

export async function getEvidenceStats(orgId: string, jobId?: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_evidence_stats", {
      p_workspace_id: orgId,
      p_job_id: jobId ?? null,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as EvidenceStats, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch evidence stats" };
  }
}

/* ── 4. Toggle Evidence Visibility ───────────────────── */

export async function toggleEvidenceVisibility(evidenceId: string, visible: boolean) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc("toggle_evidence_visibility", {
      p_evidence_id: evidenceId,
      p_visible: visible,
    });

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/jobs");
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to toggle evidence visibility" };
  }
}

/* ── 5. Update Evidence Caption ──────────────────────── */

export async function updateEvidenceCaption(evidenceId: string, caption: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("job_evidence")
      .update({ manual_caption: caption })
      .eq("id", evidenceId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/jobs");
    return { data: data as EvidenceItem, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update caption" };
  }
}

/* ── 6. Delete Evidence ──────────────────────────────── */

export async function deleteEvidence(evidenceId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Fetch the evidence record first to get storage paths
    const { data: evidence, error: fetchError } = await (supabase as any)
      .from("job_evidence")
      .select("original_path, annotated_path, thumbnail_path")
      .eq("id", evidenceId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };
    if (!evidence) return { data: null, error: "Evidence not found" };

    // Delete files from storage
    if (evidence.original_path) {
      await supabase.storage.from("evidence-raw").remove([evidence.original_path]);
    }
    if (evidence.annotated_path) {
      await supabase.storage.from("evidence-annotated").remove([evidence.annotated_path]);
    }
    if (evidence.thumbnail_path) {
      await supabase.storage.from("evidence-raw").remove([evidence.thumbnail_path]);
    }

    // Delete the database record
    const { error: deleteError } = await (supabase as any)
      .from("job_evidence")
      .delete()
      .eq("id", evidenceId);

    if (deleteError) return { data: null, error: deleteError.message };
    revalidatePath("/dashboard/jobs");
    return { data: { deleted: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete evidence" };
  }
}

/* ── 7. Get Evidence Signed URL ──────────────────────── */

export async function getEvidenceSignedUrl(path: string, bucket: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 60 min expiry

    if (error) return { data: null, error: error.message };
    return { data: data.signedUrl, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to generate signed URL" };
  }
}

/* ── 8. Mark as Defect ───────────────────────────────── */

export async function markAsDefect(evidenceId: string, isDefect: boolean) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("job_evidence")
      .update({ is_defect: isDefect })
      .eq("id", evidenceId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/jobs");
    return { data: data as EvidenceItem, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update defect status" };
  }
}
