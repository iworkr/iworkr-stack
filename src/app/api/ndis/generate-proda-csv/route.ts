/**
 * @route POST /api/ndis/generate-proda-csv
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Generates PRODA-format CSV for NDIS bulk claim submissions
 * @lastAudit 2026-03-22
 */
/**
 * Zenith-Launch: PRODA Bulk Claim CSV Generator
 *
 * POST /api/ndis/generate-proda-csv
 *
 * Calls the `generate_ndis_claim_batch` RPC to translate approved shifts
 * into NDIS claim line items and returns a strict PRODA-format CSV file
 * ready for upload to the Australian Government PRODA portal.
 *
 * Body: { organization_id, period_start?, period_end? }
 * Returns: CSV file download
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  // ── Auth Gate ──
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { organization_id, period_start, period_end } = body as {
    organization_id: string;
    period_start?: string;
    period_end?: string;
  };

  if (!organization_id) {
    return NextResponse.json(
      { error: "Missing organization_id" },
      { status: 400 }
    );
  }

  // Verify membership + admin/owner role
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organization_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Forbidden — admin or owner role required" },
      { status: 403 }
    );
  }

  // Use service role to call RPC (needs access to all tables)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const { data: result, error: rpcError } = await adminClient.rpc(
      "generate_ndis_claim_batch",
      {
        p_organization_id: organization_id,
        p_period_start: period_start || null,
        p_period_end: period_end || null,
      }
    );

    if (rpcError) {
      console.error("[PRODA CSV] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to generate claim batch", details: rpcError.message },
        { status: 500 }
      );
    }

    const batch = result as {
      batch_id: string;
      batch_number: string;
      total_claims: number;
      total_amount: number;
      csv_header: string;
      csv_rows: string[];
      validation_errors: Array<{ shift_id: string; error: string; participant: string }>;
      period_start: string;
      period_end: string;
    };

    if (batch.total_claims === 0) {
      return NextResponse.json(
        {
          error: "No billable shifts found for the selected period",
          batch_id: batch.batch_id,
          validation_errors: batch.validation_errors,
          period_start: batch.period_start,
          period_end: batch.period_end,
        },
        { status: 422 }
      );
    }

    // Build CSV content — strict PRODA format, no trailing commas
    const csvContent = [batch.csv_header, ...batch.csv_rows].join("\r\n");

    // Return CSV as downloadable file
    const filename = `PRODA_${batch.batch_number}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Batch-Id": batch.batch_id,
        "X-Batch-Number": batch.batch_number,
        "X-Total-Claims": batch.total_claims.toString(),
        "X-Total-Amount": batch.total_amount.toFixed(2),
      },
    });
  } catch (err) {
    console.error("[PRODA CSV] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
