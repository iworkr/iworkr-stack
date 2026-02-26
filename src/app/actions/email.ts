"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendJobAssignedEmail, sendInviteEmail } from "@/lib/email";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const SendJobAssignmentSchema = z.object({
  technicianEmail: z.string().email("Invalid technician email").max(255),
  technicianName: z.string().min(1).max(200),
  jobTitle: z.string().min(1).max(200),
  clientName: z.string().max(200),
  clientAddress: z.string().max(500),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  notes: z.string().max(2000).optional(),
  jobId: z.string().uuid(),
});

const SendTeamInviteSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  orgId: z.string().uuid(),
  role: z.string().min(1).max(50),
});

export async function sendJobAssignment(params: {
  technicianEmail: string;
  technicianName: string;
  jobTitle: string;
  clientName: string;
  clientAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  notes?: string;
  jobId: string;
}) {
  // Validate input
  const parsed = SendJobAssignmentSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const assignedBy = profile?.full_name || user.email || "Your manager";

  const result = await sendJobAssignedEmail({
    to: params.technicianEmail,
    technicianName: params.technicianName,
    jobTitle: params.jobTitle,
    clientName: params.clientName,
    clientAddress: params.clientAddress,
    scheduledDate: params.scheduledDate,
    scheduledTime: params.scheduledTime,
    notes: params.notes,
    assignedBy,
    jobId: params.jobId,
  });

  return result;
}

export async function sendTeamInviteEmail(params: {
  email: string;
  orgId: string;
  role: string;
}) {
  // Validate input
  const parsed = SendTeamInviteSchema.safeParse(params);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch org with branding fields (Project Genesis)
  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url, brand_color_hex")
    .eq("id", params.orgId)
    .maybeSingle();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  // Create/update the invite record
  const { data: invite, error } = await supabase
    .from("organization_invites")
    .upsert(
      {
        organization_id: params.orgId,
        email: params.email,
        role: params.role,
        status: "pending",
        invited_by: user.id,
      },
      { onConflict: "organization_id,email" }
    )
    .select()
    .single();

  if (error) return { error: error.message };

  // Genesis: use /join route with token-based validation (replaces /auth?invite=)
  const inviteToken = invite.token || invite.id;
  const inviteUrl = `${baseUrl}/join?token=${inviteToken}`;

  const result = await sendInviteEmail({
    to: params.email,
    inviterName: profile?.full_name || user.email || "A team member",
    companyName: org?.name || "your team",
    role: params.role.charAt(0).toUpperCase() + params.role.slice(1),
    inviteUrl,
    brandColorHex: org?.brand_color_hex || undefined,
    logoUrl: org?.logo_url || undefined,
  });

  return result;
}
