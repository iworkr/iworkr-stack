import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/team/invite
 * Invites a member to the current user's organization.
 * Resolves orgId server-side from the authenticated user — no client orgId needed.
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

    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve org from user's active membership — single source of truth
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

    // Only owner, admin, manager can invite
    if (!["owner", "admin", "manager"].includes(callerRole)) {
      return NextResponse.json({ error: "You don't have permission to invite members" }, { status: 403 });
    }

    // Call the invite RPC
    const { data, error } = await supabase.rpc("invite_member", {
      p_org_id: orgId,
      p_email: email,
      p_role: role,
      p_role_id: null,
      p_branch: branch || "HQ",
      p_actor_id: user.id,
    } as any);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ((data as any)?.error) {
      return NextResponse.json({ error: (data as any).error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
