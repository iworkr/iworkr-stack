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
  // These routes use secure_token auth (not session auth) because
  // they are accessed by external clients via email links.
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
      .select("id, status, secure_token, organization_id")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (!quote.secure_token || token !== quote.secure_token) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
    }

    if (quote.status === "accepted") {
      return NextResponse.json({ message: "Quote already accepted", quote_id: id });
    }

    if (!["sent", "viewed", "draft"].includes(quote.status)) {
      return NextResponse.json(
        { error: `Cannot accept quote in '${quote.status}' state` },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const signatureUrl = body.signature_url as string | undefined;
    const signedBy = body.signed_by as string | undefined;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("quotes")
      .update({
        status: "accepted",
        signed_at: new Date().toISOString(),
        signature_url: signatureUrl || null,
        signed_by: signedBy || null,
      })
      .eq("id", id)
      .select("id, job_id, invoice_id, status")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Quote accepted successfully",
      quote_id: id,
      job_id: updated.job_id,
      invoice_id: updated.invoice_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
