/**
 * @route GET /api/sites/form-schema
 * @status INCOMPLETE — security hardening pending
 * @description Public embed: returns form field schema for a template UUID (used by published sites).
 * @risk P0 — Unauthenticated; uses admin client → any templateId UUID can be probed for structure. Gate with signed token or site+template ownership before launch.
 * @lastReview 2026-03-28
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const templateId = request.nextUrl.searchParams.get("templateId");
  if (!templateId) {
    return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const { data: template } = await admin
    .from("form_templates")
    .select("title, schema_jsonb, schema")
    .eq("id", templateId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const schema = template.schema_jsonb || template.schema || {};
  const fields = Array.isArray(schema) ? schema : (schema as Record<string, unknown>).fields || [];

  return NextResponse.json({
    title: template.title,
    fields,
  });
}
