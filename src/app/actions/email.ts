"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendJobAssignedEmail, sendInviteEmail } from "@/lib/email";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
