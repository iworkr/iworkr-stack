/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { PlanReviewReportDocument } from "@/components/pdf/plan-review-report-document";
import { getPlanReviewPdfPayloadAction } from "@/app/actions/plan-reviews";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: error.message || "Failed to render preview" }, { status: 500 });
  }
}
