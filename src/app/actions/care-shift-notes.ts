"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ShiftNoteFieldSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional().default(false),
  family_visible: z.boolean().optional().default(false),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  visibility: z
    .object({
      field_id: z.string(),
      operator: z.enum(["eq", "neq", "contains", "not_contains"]),
      value: z.union([z.string(), z.number(), z.boolean()]),
    })
    .optional(),
});

const ShiftNoteSchemaPayloadSchema = z.object({
  template_name: z.string().min(1),
  version: z.number().optional(),
  fields: z.array(ShiftNoteFieldSchema),
  logic: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

const CreateTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  schema_payload: ShiftNoteSchemaPayloadSchema,
});

const CreateRuleSchema = z.object({
  organization_id: z.string().uuid(),
  template_id: z.string().uuid(),
  target_type: z.enum(["ndis_line_item", "participant", "duration", "global_default"]),
  target_value: z.string().optional(),
  min_duration_minutes: z.number().int().nonnegative().optional(),
  max_duration_minutes: z.number().int().positive().optional(),
  merge_strategy: z.enum(["override", "merge"]).optional().default("override"),
  priority: z.number().int().optional().default(0),
});

async function requireAuthedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return { supabase, user };
}

export async function listShiftNoteTemplatesAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("shift_note_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[care-shift-notes] listShiftNoteTemplatesAction", error);
    return [];
  }
}

export async function createShiftNoteTemplateAction(input: z.infer<typeof CreateTemplateSchema>) {
  const parsed = CreateTemplateSchema.parse(input);
  const { supabase, user } = await requireAuthedUser();

  const { data: latestSameName } = await (supabase as any)
    .from("shift_note_templates")
    .select("version")
    .eq("organization_id", parsed.organization_id)
    .eq("name", parsed.name)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (latestSameName?.version ?? 0) + 1;
  const schemaPayload = {
    ...parsed.schema_payload,
    template_name: parsed.name,
    version,
  };

  const { data, error } = await (supabase as any)
    .from("shift_note_templates")
    .insert({
      organization_id: parsed.organization_id,
      name: parsed.name,
      description: parsed.description ?? null,
      version,
      schema_payload: schemaPayload,
      created_by: user.id,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/templates");
  return data;
}

export async function listTemplateAssignmentRulesAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("template_assignment_rules")
      .select("*, shift_note_templates(name, version)")
      .eq("organization_id", organizationId)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[care-shift-notes] listTemplateAssignmentRulesAction", error);
    return [];
  }
}

export async function createTemplateAssignmentRuleAction(input: z.infer<typeof CreateRuleSchema>) {
  const parsed = CreateRuleSchema.parse(input);
  const { supabase } = await requireAuthedUser();

  const { data, error } = await (supabase as any)
    .from("template_assignment_rules")
    .insert({
      organization_id: parsed.organization_id,
      template_id: parsed.template_id,
      target_type: parsed.target_type,
      target_value: parsed.target_value ?? null,
      min_duration_minutes: parsed.min_duration_minutes ?? null,
      max_duration_minutes: parsed.max_duration_minutes ?? null,
      merge_strategy: parsed.merge_strategy,
      priority: parsed.priority,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/templates/rules");
  return data;
}

export async function listShiftNoteSubmissionsAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("shift_note_submissions")
      .select(
        `
          *,
          shift_note_templates(name, version),
          profiles!shift_note_submissions_worker_id_fkey(full_name),
          schedule_blocks!shift_note_submissions_shift_id_fkey(start_time, end_time, title),
          participant_profiles!shift_note_submissions_participant_id_fkey(preferred_name, full_name)
        `,
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[care-shift-notes] listShiftNoteSubmissionsAction", error);
    return [];
  }
}

export async function acknowledgeShiftNoteSubmissionAction(
  submissionId: string,
  nextStatus: "reviewed" | "archived" | "flagged",
) {
  const { supabase } = await requireAuthedUser();
  const updatePayload: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (nextStatus === "flagged") {
    updatePayload.flags = { requires_review: true };
  }
  const { data, error } = await (supabase as any)
    .from("shift_note_submissions")
    .update(updatePayload)
    .eq("id", submissionId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/notes");
  return data;
}
