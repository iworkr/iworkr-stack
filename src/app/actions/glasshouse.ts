/**
 * @module Glasshouse Server Actions
 * @status COMPLETE
 * @description Coordinator sanitization & publishing — daily updates, family-visible content curation, and coordinator dashboard
 * @exports createDailyUpdateAction, fetchDailyUpdatesAction, publishUpdateAction, sanitizeContentAction, fetchPublishedUpdates
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Project Glasshouse — Coordinator Sanitization & Publishing
// ═══════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────

export interface DailyUpdate {
  id: string;
  participant_id: string;
  title: string;
  sanitized_content: string;
  media_urls: string[];
  published_at: string;
  published_by_name?: string;
}

export interface WorkerBio {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  public_bio: string | null;
  specialties: string[];
  years_experience: number | null;
  verified_credentials: Array<{
    credential_type: string;
    credential_name: string | null;
    verification_status: string;
  }>;
}

export interface PendingNote {
  id: string;
  participant_id: string;
  participant_name: string;
  worker_name: string;
  content: string;
  family_facing_narrative: string | null;
  created_at: string;
  shift_id: string | null;
}

// ── Fetch daily updates for a participant (portal) ───────────

export async function getGlasshouseDailyUpdates(participantId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data, error } = await (supabase as any)
    .from("glasshouse_daily_updates")
    .select("id, participant_id, title, sanitized_content, media_urls, published_at, publisher:profiles!glasshouse_daily_updates_published_by_fkey(full_name)")
    .eq("participant_id", participantId)
    .order("published_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message };

  return {
    updates: (data || []).map((row: any): DailyUpdate => ({
      id: row.id,
      participant_id: row.participant_id,
      title: row.title,
      sanitized_content: row.sanitized_content,
      media_urls: row.media_urls || [],
      published_at: row.published_at,
      published_by_name: row.publisher?.full_name || null,
    })),
  };
}

// ── Fetch worker bio for public display ──────────────────────

export async function getWorkerBio(workerId: string, organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get basic profile
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", workerId)
    .maybeSingle();

  if (!profile) return null;

  // Get staff profile (bio, specialties)
  const { data: staffProfile } = await (supabase as any)
    .from("staff_profiles")
    .select("public_bio, specialties, years_experience, is_published_to_directory")
    .eq("user_id", workerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  // Get verified credentials
  const { data: credentials } = await (supabase as any)
    .from("worker_credentials")
    .select("credential_type, credential_name, verification_status")
    .eq("user_id", workerId)
    .eq("organization_id", organizationId)
    .eq("verification_status", "verified");

  return {
    user_id: profile.id,
    full_name: profile.full_name || "Support Worker",
    avatar_url: profile.avatar_url,
    public_bio: staffProfile?.public_bio || null,
    specialties: staffProfile?.specialties || [],
    years_experience: staffProfile?.years_experience || null,
    verified_credentials: (credentials || []).map((c: any) => ({
      credential_type: c.credential_type,
      credential_name: c.credential_name,
      verification_status: c.verification_status,
    })),
  } as WorkerBio;
}

// ── Fetch notes pending family-portal review (coordinator) ───

export async function getPendingFamilyNotes(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await (supabase as any)
    .from("progress_notes")
    .select(`
      id,
      participant_id,
      worker_id,
      job_id,
      context_of_support,
      outcomes_achieved,
      family_facing_narrative,
      is_published_to_portal,
      family_note_approval_status,
      created_at,
      worker:profiles!progress_notes_worker_id_fkey(full_name),
      participant:participant_profiles(preferred_name)
    `)
    .eq("organization_id", organizationId)
    .eq("is_published_to_portal", false)
    .in("family_note_approval_status", ["pending", null])
    .order("created_at", { ascending: false })
    .limit(50);

  return (data || []).map((row: any): PendingNote => ({
    id: row.id,
    participant_id: row.participant_id || "",
    participant_name: row.participant?.preferred_name || "Unknown Participant",
    worker_name: row.worker?.full_name || "Unknown Worker",
    content: [row.context_of_support, row.outcomes_achieved]
      .filter(Boolean)
      .join("\n\n") || "No content",
    family_facing_narrative: row.family_facing_narrative || null,
    created_at: row.created_at,
    shift_id: row.job_id || null,
  }));
}

// ── Publish a sanitized note to the Glasshouse feed ──────────

export async function publishToGlasshouse(input: {
  progress_note_id: string;
  participant_id: string;
  organization_id: string;
  title: string;
  sanitized_content: string;
  media_urls?: string[];
  shift_id?: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 1. Insert the sanitized daily update
  const { error: insertError } = await (supabase as any)
    .from("glasshouse_daily_updates")
    .insert({
      participant_id: input.participant_id,
      organization_id: input.organization_id,
      original_progress_note_id: input.progress_note_id,
      original_shift_id: input.shift_id || null,
      title: input.title,
      sanitized_content: input.sanitized_content,
      media_urls: input.media_urls || [],
      published_by: user.id,
    });

  if (insertError) throw new Error(insertError.message);

  // 2. Mark the source progress note as published
  await (supabase as any)
    .from("progress_notes")
    .update({
      is_published_to_portal: true,
      family_note_approval_status: "approved",
      family_facing_narrative: input.sanitized_content,
    })
    .eq("id", input.progress_note_id);

  revalidatePath("/dashboard/care/note-review");
  revalidatePath("/portal");
  revalidatePath("/portal/care-team");
}

// ── Revoke family access (Nuclear Revocation) ────────────────

export async function revokeFamilyAccess(
  participantId: string,
  familyUserId: string
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await (supabase as any)
    .from("participant_network_members")
    .delete()
    .eq("participant_id", participantId)
    .eq("user_id", familyUserId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/care/participants");
}
