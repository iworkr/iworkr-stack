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

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

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

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("name")
    .eq("id", params.orgId)
    .single();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  // Create/update the invite record
  const { data: invite, error } = await (supabase as any)
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

  const inviteUrl = `${baseUrl}/auth?invite=${invite.id}&email=${encodeURIComponent(params.email)}`;

  const result = await sendInviteEmail({
    to: params.email,
    inviterName: profile?.full_name || user.email || "A team member",
    companyName: org?.name || "your team",
    role: params.role.charAt(0).toUpperCase() + params.role.slice(1),
    inviteUrl,
  });

  return result;
}
