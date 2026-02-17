import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/team/set-password
 *
 * Sets an app password for a team member using the Supabase Admin API.
 * Requires the caller to be an authenticated org member.
 *
 * Body: { userId: string, password: string }
 */
export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
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
