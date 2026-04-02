/**
 * @route POST /api/sites/form-submit
 * @status STABLE
 * @description Public POST for website form submissions; validates template belongs to workspaceId.
 * @risk P1 — No in-file rate limit; abuse/spam possible if template IDs are guessable. Consider edge rate limit + CAPTCHA for production.
 * @lastReview 2026-03-28
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, workspaceId, data } = body;

    if (!templateId || !workspaceId || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = createAdminSupabaseClient();

    const { data: template, error: tmplError } = await admin
      .from("form_templates")
      .select("id, organization_id")
      .eq("id", templateId)
      .single();

    if (tmplError || !template) {
      return NextResponse.json({ error: "Form template not found" }, { status: 404 });
    }

    if (template.organization_id !== workspaceId) {
      return NextResponse.json({ error: "Template does not belong to workspace" }, { status: 403 });
    }

    const { error: insertError } = await admin
      .from("form_submissions")
      .insert({
        template_id: templateId,
        organization_id: workspaceId,
        data,
        source: "website",
        submitted_at: new Date().toISOString(),
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
