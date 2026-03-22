/**
 * @route GET /api/compliance/dossier
 * @status COMPLETE
 * @auth REQUIRED — Authenticated user with org membership
 * @description Generates a PDF compliance audit dossier document
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { createHash } from "crypto";
import { renderToBuffer } from "@react-pdf/renderer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuditDossierDocument, type AuditDossierPayload } from "@/components/pdf/audit-dossier-document";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organization_id");
    const participantId = url.searchParams.get("participant_id");
    const dateStart = url.searchParams.get("date_start");
    const dateEnd = url.searchParams.get("date_end");

    if (!organizationId || !dateStart || !dateEnd) {
      return NextResponse.json(
        { error: "organization_id, date_start, date_end are required" },
        { status: 400 },
      );
    }

    const [{ data: participant }, { data: agreements }, { data: notes }, { data: incidents }, { data: ledgers }] =
      await Promise.all([
        participantId
          ? supabase
              .from("participant_profiles")
              .select("id, preferred_name, ndis_number, clients(name)")
              .eq("id", participantId)
              .eq("organization_id", organizationId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("service_agreements")
          .select("title, start_date, end_date, status, total_budget, consumed_budget")
          .eq("organization_id", organizationId)
          .gte("start_date", dateStart)
          .lte("end_date", dateEnd)
          .limit(200),
        supabase
          .from("progress_notes")
          .select("created_at, summary, participant_id")
          .eq("organization_id", organizationId)
          .gte("created_at", `${dateStart}T00:00:00.000Z`)
          .lte("created_at", `${dateEnd}T23:59:59.999Z`)
          .limit(500),
        supabase
          .from("incidents")
          .select("occurred_at, title, severity, participant_id")
          .eq("organization_id", organizationId)
          .gte("occurred_at", `${dateStart}T00:00:00.000Z`)
          .lte("occurred_at", `${dateEnd}T23:59:59.999Z`)
          .limit(500),
        supabase
          .from("shift_financial_ledgers")
          .select("actual_revenue, actual_cost, schedule_block_id, participant_id")
          .eq("organization_id", organizationId)
          .limit(500),
      ]);

    const participantName =
      (participant?.preferred_name as string | null) ||
      (participant?.clients?.name as string | undefined) ||
      "Organization Sample";

    const scopedNotes = participantId
      ? (notes || []).filter((n: any) => n.participant_id === participantId)
      : (notes || []);
    const scopedIncidents = participantId
      ? (incidents || []).filter((i: any) => i.participant_id === participantId)
      : (incidents || []);
    const scopedLedgers = participantId
      ? (ledgers || []).filter((l: any) => l.participant_id === participantId)
      : (ledgers || []);

    const payload: AuditDossierPayload = {
      title: `Participant Master Dossier — ${participantName}`,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email || user.id,
      sections: [
        {
          title: "Section 1: Identity & Intake",
          lines: [
            `Participant: ${participantName}`,
            participant?.ndis_number ? `NDIS Number: ${participant.ndis_number}` : "NDIS Number: N/A",
            `Date Range: ${dateStart} to ${dateEnd}`,
          ],
        },
        {
          title: "Section 2: Governance",
          lines: (agreements || []).map(
            (a: any) =>
              `${a.title || "Service Agreement"} · ${a.status} · ${a.start_date} to ${a.end_date}`,
          ),
        },
        {
          title: "Section 3: Clinical Evidence",
          lines: scopedNotes.map(
            (n: any) => `${new Date(n.created_at).toLocaleString("en-AU")} · ${n.summary || "Progress note"}`,
          ),
        },
        {
          title: "Section 4: Incident History",
          lines: scopedIncidents.map(
            (i: any) =>
              `${new Date(i.occurred_at).toLocaleString("en-AU")} · ${i.severity?.toUpperCase()} · ${i.title}`,
          ),
        },
        {
          title: "Section 5: Financial Reconciliation",
          lines: scopedLedgers.map((l: any) => {
            const rev = Number(l.actual_revenue || 0);
            const cost = Number(l.actual_cost || 0);
            return `Shift ${String(l.schedule_block_id).slice(0, 8)}... · Revenue $${rev.toFixed(2)} · Cost $${cost.toFixed(2)}`;
          }),
        },
      ],
    };

    const finalBuffer = await renderToBuffer(
      createElement(AuditDossierDocument, { payload }) as Parameters<typeof renderToBuffer>[0],
    );
    const finalHash = createHash("sha256")
      .update(
        Buffer.isBuffer(finalBuffer)
          ? finalBuffer
          : Buffer.from(finalBuffer as ArrayBuffer),
      )
      .digest("hex");

    const fileName = `ironclad-dossier-${participantId || "org"}-${dateStart}-${dateEnd}.pdf`;
    const storagePath = `compliance/dossiers/${organizationId}/${fileName}`;
    const pdfBody = new Uint8Array(
      typeof finalBuffer === "object" && "length" in finalBuffer
        ? (finalBuffer as ArrayLike<number>)
        : (finalBuffer as ArrayBuffer),
    );
    const upload = await supabase.storage.from("documents").upload(storagePath, pdfBody, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upload.error) {
      return NextResponse.json({ error: upload.error.message }, { status: 500 });
    }

    await supabase.from("document_hashes").insert({
      organization_id: organizationId,
      generated_by: user.id,
      document_type: "participant_master_dossier",
      sha256_hash: finalHash,
      metadata: {
        storage_path: storagePath,
        participant_id: participantId,
        participant_name: participantName,
        date_start: dateStart,
        date_end: dateEnd,
      },
    });
    return new NextResponse(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Document-Sha256": finalHash,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate dossier" }, { status: 500 });
  }
}
