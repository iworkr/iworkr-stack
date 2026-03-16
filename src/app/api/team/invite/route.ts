import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendInviteEmail } from "@/lib/email";

/**
 * POST /api/team/invite
 *
 * Full invite pipeline:
 * 1. Resolve org from authenticated user (zero client-side orgId needed)
 * 2. Permission check (owner / admin / manager only)
 * 3. Upsert invite record with secure token + 7-day expiry
 * 4. Send branded invite email via Resend
 * 5. Return invite details
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, role, branch } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // ── 1. Auth ──────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Resolve org + permission check ────────────────────
    const { data: membership } = await (supabase as any)
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!membership?.organization_id) {
      return NextResponse.json({ error: "No active organization found" }, { status: 400 });
    }

    const orgId = membership.organization_id;
    const callerRole = membership.role;

    if (!["owner", "admin", "manager"].includes(callerRole)) {
      return NextResponse.json({ error: "You don't have permission to invite members" }, { status: 403 });
    }

    // ── 3. Service-role client for bypassing RLS ─────────────
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if already a member
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: existingMember } = await serviceClient
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: "This person is already a member of your team" }, { status: 409 });
      }
    }

    // ── 4. Upsert invite with secure token ───────────────────
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await serviceClient
      .from("organization_invites")
      .upsert(
        {
          organization_id: orgId,
          email,
          role: role || "technician",
          status: "pending",
          invited_by: user.id,
          token,
          expires_at: expiresAt,
        },
        { onConflict: "organization_id,email" }
      )
      .select()
      .single();

    if (inviteError) {
      console.error("[invite] upsert error:", inviteError.message);
      return NextResponse.json({ error: inviteError.message }, { status: 500 });
    }

    // ── 5. Audit log ─────────────────────────────────────────
    try {
      await serviceClient.from("audit_log").insert({
        organization_id: orgId,
        user_id: user.id,
        action: "member.invited",
        entity_type: "organization_invite",
        entity_id: invite.id,
        new_data: { email, role: role || "technician" },
      });
    } catch { /* audit is non-fatal */ }

    // ── 6. Send invite email ─────────────────────────────────
    let emailSent = false;
    try {
      // Get org info for branding
      const { data: org } = await serviceClient
        .from("organizations")
        .select("name, logo_url, brand_color_hex")
        .eq("id", orgId)
        .single();

      // Get inviter name
      const { data: inviterProfile } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      const orgName = org?.name || "your team";
      const inviterName = inviterProfile?.full_name || user.email || "A team member";
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://iworkrapp.com";
      const inviteUrl = `${baseUrl}/accept-invite?token=${invite.token || token}`;

      await sendInviteEmail({
        to: email,
        inviterName,
        companyName: orgName,
        role: (role || "technician").charAt(0).toUpperCase() + (role || "technician").slice(1),
        inviteUrl,
        brandColorHex: org?.brand_color_hex || undefined,
        logoUrl: org?.logo_url || undefined,
      });

      emailSent = true;
    } catch (emailErr: any) {
      // Email failure is non-fatal — invite record is still created
      console.error("[invite] email send failed:", emailErr.message);
    }

    return NextResponse.json({
      success: true,
      invite_id: invite.id,
      email,
      role,
      expires_at: expiresAt,
      email_sent: emailSent,
    });
  } catch (err: any) {
    console.error("[invite] exception:", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
