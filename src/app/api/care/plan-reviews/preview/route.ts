/**
 * @route GET /api/care/plan-reviews/preview
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user session
 * @description Generates a PDF preview of a care plan review report
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PlanReviewReportDocument } from "@/components/pdf/plan-review-report-document";
import { getPlanReviewPdfPayloadAction } from "@/app/actions/plan-reviews";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // ── Aegis-Zero: Session Gate ──
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Valid authentication session required." },
      { status: 401 }
    );
  }

  try {
    const reportId = new URL(request.url).searchParams.get("report_id");
    if (!reportId) {
      return NextResponse.json({ error: "report_id is required" }, { status: 400 });
    }
    const payload = await getPlanReviewPdfPayloadAction(reportId);
    const pdfBuffer = await renderToBuffer(
      createElement(PlanReviewReportDocument, { payload }) as Parameters<typeof renderToBuffer>[0],
    );
    const bytes = new Uint8Array(pdfBuffer as ArrayLike<number>);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[care/plan-reviews/preview] error:", error);
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
