/**
 * @module Onboarding Server Actions
 * @status COMPLETE
 * @description Organization onboarding wizard — org creation, trade selection, team invites, and welcome email dispatch
 * @exports createOrganization, completeOnboarding, inviteTeamMembers, updateOrganizationSetup, skipOnboardingStep
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { sendWelcomeEmail, sendInviteEmail } from "@/lib/email";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const CreateOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(100),
  trade: z.string().max(100).optional().nullable(),
  industryType: z.enum(["trades", "care"]).optional().nullable(),
});

const UpdateTradeSchema = z.string().min(1, "Trade is required").max(100);

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
  industryType?: string | null;
}) {
  try {
    // Validate input
    const parsed = CreateOrganizationSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Guard: prevent duplicate orgs with the same name for the same user
    // Check if user already owns an org with this exact name
    const { data: existingOrgs } = await (supabase as any)
      .from("organization_members")
      .select("organization_id, organizations(id, name)")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .eq("status", "active");

    const normalizedName = data.name.trim().toLowerCase();
    const alreadyExists = (existingOrgs || []).find(
      (m: any) => m.organizations?.name?.trim().toLowerCase() === normalizedName
    );

    if (alreadyExists) {
      // Return the existing org instead of creating a duplicate
      return { organization: alreadyExists.organizations };
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
        org_trade: (data.trade || null) as string | undefined,
      }
    );

    if (error) {
      return { error: error.message };
    }

    // Set the industry type on the new org if specified
    if (data.industryType && result) {
      const orgId = typeof result === "string" ? result : (result as any)?.id;
      if (orgId) {
        await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .from("organizations")
          .update({ industry_type: data.industryType })
          .eq("id", orgId);
      }
    }

    return { organization: result };
  } catch (err) {
    console.error("[onboarding] createOrganization error:", err);
    return { error: (err as Error).message || "An unexpected error occurred" };
  }
}

export async function updateOrganizationTrade(orgId: string, trade: string) {
  try {
    // Validate input
    const parsed = UpdateTradeSchema.safeParse(trade);
    if (!parsed.success) {
      return { error: parsed.error.issues.map(e => e.message).join("; ") };
    }

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
  } catch (err) {
    console.error("[onboarding] updateOrganizationTrade error:", err);
    return { error: (err as Error).message || "An unexpected error occurred" };
  }
}

export async function sendTeamInvites(
  orgId: string,
  emails: string[]
) {
  try {
    // Limit batch size to prevent abuse
    if (emails.length > 20) return { error: "Maximum 20 invites at a time" };

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { error: "Unauthorized" };

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

    const results: { email: string; success: boolean; emailSent?: boolean; error?: string }[] = [];

    const emailPayloads = emails.map((email) => ({
      organization_id: orgId,
      email,
      role: "technician" as const,
      status: "pending" as const,
      invited_by: user.id,
    }));

    const { data: invites, error: upsertError } = await supabase
      .from("organization_invites")
      .upsert(emailPayloads, { onConflict: "organization_id,email" })
      .select();

    const inviteByEmail = new Map((invites ?? []).map((inv) => [inv.email as string, inv]));

    for (const email of emails) {
      const invite = inviteByEmail.get(email);
      const error = upsertError;

      let emailSent = true;
      if (!error && invite) {
        // Genesis: use /join route with token-based SSR validation
        const inviteToken = invite.token || invite.id;
        const inviteUrl = `${baseUrl}/join?token=${inviteToken}`;
        try {
          await sendInviteEmail({
            to: email,
            inviterName,
            companyName,
            role: "Technician",
            inviteUrl,
            brandColorHex: org?.brand_color_hex || undefined,
            logoUrl: org?.logo_url || undefined,
          });
        } catch (emailErr) {
          console.error("[Email] Invite send failed:", emailErr);
          emailSent = false;
        }
      }

      results.push({
        email,
        success: !error && !!invite,
        emailSent,
        error:
          error?.message ||
          (!invite && !error ? "Invite could not be created" : undefined) ||
          (invite && !emailSent ? "Invite created but email delivery failed" : undefined),
      });
    }

    return { results };
  } catch (err) {
    console.error("[onboarding] sendTeamInvites error:", err);
    return { error: (err as Error).message || "An unexpected error occurred" };
  }
}

export async function completeOnboarding() {
  try {
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
  } catch (err) {
    console.error("[onboarding] completeOnboarding error:", err);
    return { error: (err as Error).message || "An unexpected error occurred" };
  }
}
