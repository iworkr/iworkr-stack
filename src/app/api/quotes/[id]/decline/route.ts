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
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const { data: quote, error: fetchErr } = await supabaseAdmin
      .from("quotes")
      .select("id, status, secure_token")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // INCOMPLETE:PARTIAL — weak token validation; token is optional, quote can be declined without authentication.
    if (token && quote.secure_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
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
