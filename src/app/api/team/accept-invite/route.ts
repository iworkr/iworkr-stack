/**
 * @route POST /api/team/accept-invite
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user session
 * @description Accepts a team invite, adds user to org, and updates profile
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/team/accept-invite
 *
 * Accepts an invite: optionally updates profile, adds user to org, marks invite accepted.
 * Uses service role for all writes (no RLS issues).
 *
 * Body: { token: string, full_name?: string, phone?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, full_name, phone } = body;

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // ── 1. Get authenticated user from cookies ───────────
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be signed in to accept an invitation. Please create an account first." }, { status: 401 });
    }

    // ── 2. Service role client for all writes ────────────
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── 3. Fetch and validate invite ─────────────────────
    const { data: invite, error: fetchErr } = await serviceClient
      .from("organization_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invite.status === "accepted") {
      // Already accepted — just redirect, don't error
      return NextResponse.json({
        success: true,
        already_accepted: true,
        organization_id: invite.organization_id,
      });
    }

    if (invite.status !== "pending") {
      return NextResponse.json({ error: `This invitation is ${invite.status}` }, { status: 400 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    // ── 4. Update profile if provided ────────────────────
    if (full_name) {
      await serviceClient
        .from("profiles")
        .upsert({
          id: user.id,
          email: user.email || invite.email,
          full_name: full_name,
          phone: phone || null,
          onboarding_completed: true,
        }, { onConflict: "id" });
    } else {
      // Ensure profile exists at minimum
      const { data: existing } = await serviceClient
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!existing) {
        await serviceClient
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email || invite.email,
          });
      }
    }

    // ── 5. Check if already a member ─────────────────────
    const { data: existingMember } = await serviceClient
      .from("organization_members")
      .select("user_id, status")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember) {
      // Already a member — mark invite accepted, return success
      await serviceClient
        .from("organization_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      return NextResponse.json({
        success: true,
        already_member: true,
        organization_id: invite.organization_id,
      });
    }

    // ── 6. Add user as organization member ───────────────
    const { error: insertErr } = await serviceClient
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        branch_id: invite.branch_id || null,
        status: "active",
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error("[accept-invite] member insert error:", insertErr.message);
      return NextResponse.json({ error: "Failed to add you to the team: " + insertErr.message }, { status: 500 });
    }

    // ── 7. Mark invite as accepted ───────────────────────
    await serviceClient
      .from("organization_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    // ── 8. Audit log (non-fatal) ─────────────────────────
    try {
      await serviceClient.from("audit_log").insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        action: "member.joined",
        entity_type: "organization_member",
        entity_id: user.id,
        new_data: {
          role: invite.role,
          branch_id: invite.branch_id || null,
          via: "invite_accept",
          full_name: full_name || null,
        },
      });
    } catch { /* non-fatal */ }

    // ── 9. Get org info for response ─────────────────────
    const { data: org } = await serviceClient
      .from("organizations")
      .select("name, slug")
      .eq("id", invite.organization_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      organization_id: invite.organization_id,
      organization_name: org?.name || "Your team",
      organization_slug: org?.slug || null,
      role: invite.role,
    });
  } catch (err: any) {
    console.error("[accept-invite] error:", err);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
