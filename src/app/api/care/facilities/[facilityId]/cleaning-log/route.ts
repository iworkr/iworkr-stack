import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  FacilityCleaningLogDocument,
  type FacilityCleaningLogPayload,
} from "@/components/pdf/facility-cleaning-log-document";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ facilityId: string }> },
) {
  try {
    const { facilityId } = await context.params;
    const startDate = request.nextUrl.searchParams.get("start");
    const endDate = request.nextUrl.searchParams.get("end");
    const organizationId = request.nextUrl.searchParams.get("orgId");

    if (!facilityId || !startDate || !endDate || !organizationId) {
      return NextResponse.json({ error: "Missing required query params" }, { status: 400 });
    }

    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: facility, error: facilityError }, { data: rows, error: rowsError }] = await Promise.all([
      supabase
        .from("care_facilities")
        .select("id, name, organization_id")
        .eq("id", facilityId)
        .eq("organization_id", organizationId)
        .single(),
      supabase
        .from("task_instances")
        .select("*, profiles!task_instances_completed_by_user_id_fkey(full_name, email)")
        .eq("organization_id", organizationId)
        .eq("facility_id", facilityId)
        .gte("target_date", startDate)
        .lte("target_date", endDate)
        .order("target_date", { ascending: true })
        .order("completed_at", { ascending: true }),
    ]);

    if (facilityError || !facility) {
      return NextResponse.json({ error: facilityError?.message || "Facility not found" }, { status: 404 });
    }
    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 400 });
    }

    const payload: FacilityCleaningLogPayload = {
      facilityName: facility.name,
      generatedAt: new Date().toISOString(),
      startDate,
      endDate,
      generatedBy: user.email || user.id,
      rows: (rows || []).map((row: any) => ({
        id: row.id as string,
        target_date: row.target_date as string,
        title: row.title as string,
        status: row.status,
        completed_at: row.completed_at,
        exemption_reason: row.exemption_reason,
        exemption_note: row.exemption_note,
        evidence_data: row.evidence_data || {},
        worker_name: row.profiles?.full_name || row.profiles?.email || null,
      })),
    };

    const element = createElement(FacilityCleaningLogDocument, { payload });
    const pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
    const pdfBody = new Uint8Array(
      typeof pdfBuffer === "object" && "length" in pdfBuffer
        ? (pdfBuffer as ArrayLike<number>)
        : (pdfBuffer as ArrayBuffer),
    );

    return new NextResponse(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${facility.name.replace(/\s+/g, "_")}-cleaning-log.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to generate PDF" }, { status: 500 });
  }
}
