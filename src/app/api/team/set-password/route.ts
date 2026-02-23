import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { rateLimit, getIdentifier } from "@/lib/rate-limit";

/**
 * POST /api/team/set-password
 *
 * Sets an app password for a team member using the Supabase Admin API.
 * Requires the caller to be an admin/owner in the target user's org.
 *
 * Body: { userId: string, password: string }
 */
export async function POST(request: Request) {
  try {
    // Rate limit: 5 requests per minute per IP
    const rl = rateLimit(`set-password:${getIdentifier(request)}`, { limit: 5, windowSeconds: 60 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const { userId, password } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Verify the caller is authenticated
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();

    if (!caller) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify the caller is admin/owner in the target user's org
    // First, find the target user's organization(s)
    const { data: targetMembership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .single() as { data: { organization_id: string } | null };

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Target user not found in any organization" },
        { status: 404 }
      );
    }

    // Check the caller has admin or owner role in the same org
    const { data: callerMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", targetMembership.organization_id)
      .eq("status", "active")
      .single() as { data: { role: string } | null };

    if (!callerMembership || !["admin", "owner"].includes(callerMembership.role)) {
      return NextResponse.json(
        { error: "Only org admins and owners can set team member passwords" },
        { status: 403 }
      );
    }

    // Use the admin client (service role) to update the target user's password
    const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!adminKey) {
      return NextResponse.json(
        { error: "Service role key not configured" },
        { status: 500 }
      );
    }

    const adminClient = createClient(adminUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await adminClient.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      email: data.user.email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
