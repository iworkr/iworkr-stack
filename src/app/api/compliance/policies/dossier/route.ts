/**
 * @route GET /api/compliance/policies/dossier
 * @status COMPLETE
 * @auth REQUIRED — Authenticated via server action
 * @description Generates a PDF policy compliance dossier report
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPolicyDossierDataAction } from "@/app/actions/governance-policies";
import { PolicyComplianceDossierDocument } from "@/components/pdf/policy-compliance-dossier-document";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const policyId = request.nextUrl.searchParams.get("policy_id");
    const organizationId = request.nextUrl.searchParams.get("organization_id");
    if (!policyId || !organizationId) {
      return NextResponse.json({ error: "policy_id and organization_id are required" }, { status: 400 });
    }

    let data;
    try {
      data = await getPolicyDossierDataAction({
        policy_id: policyId,
        organization_id: organizationId,
      });
    } catch (authErr: any) {
      if (authErr?.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw authErr;
    }
    const currentVersion = (data.policy?.policy_versions || []).find((v: any) => v.id === data.policy?.current_version_id)
      || (data.policy?.policy_versions || [])[0]
      || null;

    const element = createElement(PolicyComplianceDossierDocument, {
      title: data.policy?.title || "Policy",
      version: currentVersion?.version_number || data.policy?.version || "1.0",
      policyText: currentVersion?.rich_text_content || data.policy?.content || "",
      rows: (data.acknowledgements || []).map((row: any) => ({
        worker_name: row.profiles?.full_name || "",
        worker_email: row.profiles?.email || "",
        status: row.status || "pending",
        acknowledged_at: row.acknowledged_at || null,
        ip_address: row.ip_address || null,
      })),
    });
    const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
    const body = new Uint8Array(buffer as ArrayLike<number>);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"policy-compliance-dossier.pdf\"",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

