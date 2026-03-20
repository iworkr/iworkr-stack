import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    await admin
      .from("impersonation_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
