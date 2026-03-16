import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/team/accept-invite
 * Accepts an invite: adds user to org, marks invite as accepted.
 * Requires authenticated user.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Service role for writes
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch invite
    const { data: invite, error: fetchErr } = await serviceClient
      .from("organization_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: "Invite not found or already used" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    // Check if already a member
    const { data: existing } = await serviceClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", invite.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Mark invite as accepted anyway
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

    // Add user as organization member
    const { error: insertErr } = await serviceClient
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        invited_by: invite.invited_by,
        joined_at: new Date().toISOString(),
      });

    if (insertErr) {
      console.error("[accept-invite] member insert error:", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Mark invite as accepted
    await serviceClient
      .from("organization_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    // Ensure profile exists
    await serviceClient
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email || invite.email,
      }, { onConflict: "id" });

    // Audit log (non-fatal)
    try {
      await serviceClient.from("audit_log").insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        action: "member.joined",
        entity_type: "organization_member",
        entity_id: user.id,
        new_data: { role: invite.role, via: "invite_accept" },
      });
    } catch { /* non-fatal */ }

    // Get org info for response
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
    console.error("[accept-invite] exception:", err.message);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
