/**
 * @route GET /api/user/organization
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user session
 * @description Returns the authenticated user's organization ID
 * @lastAudit 2026-03-22
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await supabase
      .from("organization_members" as never)
      .select("organization_id")
      .eq("user_id" as never, user.id)
      .eq("status" as never, "active")
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      organization_id: (data as Record<string, string> | null)?.organization_id || null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to resolve organization" }, { status: 500 });
  }
}
