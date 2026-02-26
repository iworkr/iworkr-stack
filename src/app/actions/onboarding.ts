"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendWelcomeEmail, sendInviteEmail } from "@/lib/email";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function createOrganization(data: {
  name: string;
  trade: string | null;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  let slug = slugify(data.name);
  if (!slug) slug = "workspace";

  // Append suffix to avoid slug collisions
  slug = `${slug}-${Date.now().toString(36)}`;

  // Use the SECURITY DEFINER function to atomically create org + owner membership
  const { data: result, error } = await supabase.rpc(
    "create_organization_with_owner",
    {
      org_name: data.name,
      org_slug: slug,
      org_trade: data.trade || null,
    }
  );

  if (error) {
    return { error: error.message };
  }

  return { organization: result };
}

export async function updateOrganizationTrade(orgId: string, trade: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ trade })
    .eq("id", orgId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function sendTeamInvites(
  orgId: string,
  emails: string[]
) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get org name + branding and inviter profile for the email (Project Genesis)
  const { data: org } = await supabase
    .from("organizations")
    .select("name, logo_url, brand_color_hex")
    .eq("id", orgId)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const inviterName = profile?.full_name || user.email || "A team member";
  const companyName = org?.name || "your team";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const email of emails) {
    const { data: invite, error } = await supabase
      .from("organization_invites")
      .upsert(
        {
          organization_id: orgId,
          email,
          role: "technician",
          status: "pending",
          invited_by: user.id,
        },
        { onConflict: "organization_id,email" }
      )
      .select()
      .single();

    if (!error && invite) {
      // Genesis: use /join route with token-based SSR validation
      const inviteToken = invite.token || invite.id;
      const inviteUrl = `${baseUrl}/join?token=${inviteToken}`;
      await sendInviteEmail({
        to: email,
        inviterName,
        companyName,
        role: "Technician",
        inviteUrl,
        brandColorHex: org?.brand_color_hex || undefined,
        logoUrl: org?.logo_url || undefined,
      }).catch((err) => console.error("[Email] Invite send failed:", err));
    }

    results.push({
      email,
      success: !error,
      error: error?.message,
    });
  }

  return { results };
}

export async function completeOnboarding() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // Send welcome email
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Get the user's first org
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const orgName = membership?.organizations?.name;

  await sendWelcomeEmail({
    to: user.email!,
    name: profile?.full_name || user.email?.split("@")[0] || "there",
    companyName: orgName,
  }).catch((err) => console.error("[Email] Welcome send failed:", err));

  return { success: true };
}
