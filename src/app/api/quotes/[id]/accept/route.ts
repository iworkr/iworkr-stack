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
      .select("id, status, secure_token, organization_id")
      .eq("id", id)
      .single();

    if (fetchErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (token && quote.secure_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 });
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

    // The DB trigger (migration 039) handles job + invoice creation on accept
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
