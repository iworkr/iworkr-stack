/**
 * @route POST /api/team/validate-invite
 * @status COMPLETE
 * @auth PUBLIC — No auth required, token-based validation
 * @description Validates a team invite token server-side for the onboarding flow
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/team/validate-invite
 * Validates an invite token server-side using service role (bypasses RLS).
 * No auth required — this is the first step of the onboarding flow.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({
        valid: false,
        error: "No invite token provided",
      });
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Direct query — no dependency on RPC existing
    const { data: invite, error } = await serviceClient
      .from("organization_invites")
      .select(`
        id,
        email,
        role,
        status,
        token,
        expires_at,
        organization_id,
        invited_by,
        organizations!inner ( name, slug, logo_url, brand_color_hex ),
        profiles!organization_invites_invited_by_fkey ( full_name )
      `)
      .eq("token", token)
      .maybeSingle();

    if (error) {
      console.error("[validate-invite] query error:", error.message);
      // Fallback: try simpler query without joins
      const { data: simpleInvite, error: simpleError } = await serviceClient
        .from("organization_invites")
        .select("id, email, role, status, token, expires_at, organization_id, invited_by")
        .eq("token", token)
        .maybeSingle();

      if (simpleError || !simpleInvite) {
        return NextResponse.json({
          valid: false,
          error: "Invitation not found",
        });
      }

      // Got the invite, now get org and inviter separately
      const { data: org } = await serviceClient
        .from("organizations")
        .select("name, slug, logo_url, brand_color_hex")
        .eq("id", simpleInvite.organization_id)
        .maybeSingle();

      const { data: inviter } = await serviceClient
        .from("profiles")
        .select("full_name")
        .eq("id", simpleInvite.invited_by)
        .maybeSingle();

      return validateAndRespond(simpleInvite, org, inviter);
    }

    if (!invite) {
      return NextResponse.json({
        valid: false,
        error: "Invitation not found",
      });
    }

    // Extract joined data
    const org = (invite as any).organizations;
    const inviter = (invite as any).profiles;

    return validateAndRespond(invite, org, inviter);
  } catch (err: any) {
    console.error("[validate-invite] exception:", err.message);
    return NextResponse.json({
      valid: false,
      error: "Failed to validate invitation",
    });
  }
}

function validateAndRespond(
  invite: any,
  org: any,
  inviter: any
) {
  if (invite.status === "accepted") {
    return NextResponse.json({
      valid: false,
      error: "This invitation has already been claimed",
    });
  }

  if (invite.status === "revoked") {
    return NextResponse.json({
      valid: false,
      error: "This invitation has been cancelled by the administrator",
    });
  }

  if (invite.status === "expired" || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
    return NextResponse.json({
      valid: false,
      error: "This invitation has expired",
    });
  }

  if (invite.status !== "pending") {
    return NextResponse.json({
      valid: false,
      error: "This invitation is no longer valid",
    });
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    role: invite.role,
    organization_id: invite.organization_id,
    organization_name: org?.name || "Your team",
    organization_slug: org?.slug || null,
    organization_logo: org?.logo_url || null,
    brand_color: org?.brand_color_hex || null,
    inviter_name: inviter?.full_name || "A team member",
    expires_at: invite.expires_at,
  });
}
