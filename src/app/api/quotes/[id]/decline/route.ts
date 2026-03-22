/**
 * @route POST /api/quotes/[id]/decline
 * @status COMPLETE
 * @auth PUBLIC — Secure token verification (email link access)
 * @description Declines a quote via secure token with optional reason
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // ── Aegis-Zero: Early token validation gate ──
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.length < 16) {
    return NextResponse.json(
      { error: "Unauthorized", message: "A valid secure token is required." },
      { status: 401 }
    );
  }

  if (!id || typeof id !== "string" || id.length < 10) {
    return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { data: quote, error: fetchErr } = await supabaseAdmin
      .from("quotes")
      .select("id, status, secure_token")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (!quote.secure_token || token !== quote.secure_token) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
    }

    if (quote.status === "rejected") {
      return NextResponse.json({ message: "Quote already declined" });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason as string | undefined;

    const { error: updateErr } = await supabaseAdmin
      .from("quotes")
      .update({
        status: "rejected",
        metadata: reason ? { decline_reason: reason } : {},
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Quote declined", quote_id: id });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
