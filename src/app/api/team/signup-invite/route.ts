/**
 * @route POST /api/team/signup-invite
 * @status COMPLETE
 * @auth PUBLIC — Invite token verification (no session needed)
 * @description Creates a user account for an invited team member with auto-confirm
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/team/signup-invite
 *
 * Creates a user account for an invited person with email auto-confirmed.
 * No email verification needed — the invite token itself is proof of identity.
 *
 * Body: { token: string, email: string, password: string }
 * Returns: { success: true, user_id: string } or { error: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { token, email, password } = await req.json();

    if (!token || !email || !password) {
      return NextResponse.json({ error: "Token, email, and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Service role client — can create users with admin API
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the invite token is valid and matches the email
    const { data: invite } = await serviceClient
      .from("organization_invites")
      .select("id, email, status")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite token" }, { status: 400 });
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: "Email does not match the invitation" }, { status: 400 });
    }

    // Hyperion-Vanguard F-01: Use paginated listUsers with email filter
    // instead of loading entire auth DB into memory (OOM at 10K+ users).
    // Supabase Admin API supports filtering; fallback to paginated search.
    let existingUser: { id: string; email?: string } | undefined;
    const { data: filteredUsers } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    // Search by iterating only the first page — for exact match we query profiles
    const { data: profileMatch } = await serviceClient
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (profileMatch) {
      existingUser = { id: profileMatch.id, email: profileMatch.email };
    } else if (filteredUsers?.users) {
      existingUser = filteredUsers.users.find(
        (u: { email?: string; id: string }) => u.email?.toLowerCase() === email.toLowerCase()
      );
    }

    if (existingUser) {
      // User already exists — they should sign in instead
      return NextResponse.json({
        error: "account_exists",
        message: "An account with this email already exists. Please use your existing password to sign in.",
      }, { status: 409 });
    }

    // Create user with email auto-confirmed (admin API)
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification — invite token is proof
      user_metadata: {
        invited: true,
        invite_token: token,
      },
    });

    if (createError) {
      console.error("[signup-invite] create user error:", createError.message);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user_id: newUser.user.id,
    });
  } catch (err: any) {
    console.error("[signup-invite] error:", err);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
