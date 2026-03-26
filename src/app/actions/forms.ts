/**
 * @module Forms Server Actions
 * @status COMPLETE
 * @description Dynamic form builder — form CRUD, field configuration, submission capture, and form template management
 * @exports createForm, updateForm, deleteForm, fetchForms, submitFormResponse
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { validate, uuidSchema } from "@/lib/validation";

/* ── Schemas ──────────────────────────────────────── */

const CreateFormSchema = z.object({
  organization_id: uuidSchema,
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
});

const UpdateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.string().max(50).optional(),
  blocks: z.array(z.record(z.string(), z.unknown())).optional(),
  category: z.string().max(100).optional(),
  layout_config: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const CreateFormTemplateDraftSchema = z.object({
  workspace_id: uuidSchema,
  title: z.string().min(1, "Title is required").max(200).default("Untitled Form"),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  schema_jsonb: z.array(z.record(z.string(), z.unknown())).optional(),
});

const UpdateFormTemplateDraftSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.string().max(50).optional(),
  category: z.string().max(100).optional(),
  schema_jsonb: z.array(z.record(z.string(), z.unknown())).optional(),
});

/* ── Types ─────────────────────────────────────────── */

export interface FormsOverview {
  total_templates: number;
  published_templates: number;
  total_submissions: number;
  signed_submissions: number;
  pending_submissions: number;
  expired_submissions: number;
}

export interface GlobalFormTemplate {
  id: string;
  title: string;
  description: string;
  sector: "TRADES" | "CARE" | "ALL";
  category: "SAFETY" | "COMPLIANCE" | "CLINICAL" | "INSPECTION";
  schema_jsonb: Record<string, unknown>[];
  is_premium: boolean;
  clone_count: number;
  created_at: string;
}

function mapTemplateToLegacyForm(template: Record<string, any>) {
  return {
    ...template,
    organization_id: template.workspace_id,
    blocks: template.schema_jsonb ?? [],
  };
}

/* ── Forms CRUD ────────────────────────────────────── */

export async function createFormTemplateDraft(params: {
  workspace_id: string;
  title?: string;
  description?: string;
  category?: string;
  schema_jsonb?: any[];
}) {
  try {
    const validated = validate(CreateFormTemplateDraftSchema, {
      ...params,
      title: params.title ?? "Untitled Form",
    });
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .insert({
        workspace_id: params.workspace_id,
        title: params.title ?? "Untitled Form",
        description: params.description ?? "",
        category: params.category ?? "custom",
        status: "draft",
        schema_jsonb: params.schema_jsonb ?? [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/forms");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getFormTemplateById(templateId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .select("*")
      .eq("id", templateId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Form template not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const mapped = data?.forms
      ? {
          ...data,
          forms: {
            ...data.forms,
            blocks: (data.forms as any).schema_jsonb ?? [],
          },
        }
      : data;

    return { data: mapped, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateFormTemplateDraft(
  templateId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    category?: string;
    schema_jsonb?: any[];
  }
) {
  try {
    const validated = validate(UpdateFormTemplateDraftSchema, updates);
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: template } = await (supabase as any)
      .from("form_templates")
      .select("workspace_id")
      .eq("id", templateId)
      .maybeSingle();
    if (!template) return { data: null, error: "Form template not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", template.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .update(updates)
      .eq("id", templateId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/forms");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function publishFormTemplate(templateId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: template } = await (supabase as any)
      .from("form_templates")
      .select("workspace_id, schema_jsonb")
      .eq("id", templateId)
      .maybeSingle();
    if (!template) return { data: null, error: "Form template not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", template.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    if (!Array.isArray(template.schema_jsonb) || template.schema_jsonb.length === 0) {
      return { data: null, error: "Add at least one field before publishing." };
    }

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .update({ status: "published" })
      .eq("id", templateId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/forms");
    return { data, error: null };
  } catch (err: any) {
    logger.error("publishFormTemplate exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function getForms(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .select("*")
      .eq("workspace_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data || []).map(mapTemplateToLegacyForm), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getForm(formId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("form_templates")
      .select("*")
      .eq("id", formId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Form not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    return { data: mapTemplateToLegacyForm(data), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function createForm(params: {
  organization_id: string;
  title: string;
  description?: string;
  category?: string;
  blocks?: any[];
}) {
  try {
    const validated = validate(CreateFormSchema, params);
    if (validated.error) return { data: null, error: validated.error };
    const result = await createFormTemplateDraft({
      workspace_id: params.organization_id,
      title: params.title,
      description: params.description,
      category: params.category,
      schema_jsonb: params.blocks,
    });
    if (result.error || !result.data) return { data: null, error: result.error };
    return { data: mapTemplateToLegacyForm(result.data), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateForm(
  formId: string,
  updates: {
    title?: string;
    description?: string;
    status?: string;
    blocks?: any[];
    category?: string;
    layout_config?: any;
    settings?: any;
  }
) {
  try {
    const validated = validate(UpdateFormSchema, updates);
    if (validated.error) return { data: null, error: validated.error };
    const result = await updateFormTemplateDraft(formId, {
      title: updates.title,
      description: updates.description,
      status: updates.status,
      category: updates.category,
      schema_jsonb: updates.blocks,
    });
    if (result.error || !result.data) return { data: null, error: result.error };
    return { data: mapTemplateToLegacyForm(result.data), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteForm(formId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: form } = await supabase
      .from("forms")
      .select("organization_id")
      .eq("id", formId)
      .maybeSingle();
    if (!form) return { data: null, error: "Form not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", form.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { error } = await supabase
      .from("forms")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", formId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/forms");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Publish Form (version bump) ───────────────────── */

export async function publishForm(formId: string) {
  try {
    const result = await publishFormTemplate(formId);
    if (result.error || !result.data) return { data: null, error: result.error };
    return { data: mapTemplateToLegacyForm(result.data), error: null };
  } catch (err: any) {
    logger.error("publishForm exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Submissions ───────────────────────────────────── */

export async function getFormSubmissions(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("form_submissions")
      .select(
        `
        *,
        form_templates:template_id (title, category, version)
      `
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getFormSubmission(submissionId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("form_submissions")
      .select(
        `
        *,
        form_templates:template_id (title, category, schema_jsonb, version)
      `
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: null };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function createFormSubmission(params: {
  form_id: string;
  organization_id: string;
  job_id?: string;
  client_id?: string;
  data: any;
}) {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("form_submissions")
      .insert({
        ...params,
        template_id: params.form_id,
        submission_data_jsonb: params.data,
        submitted_by: user.id,
        worker_id: user.id,
        submitted_at: new Date().toISOString(),
        submitter_name: profile?.full_name || user?.email,
        status: "pending",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    await supabase.rpc("increment_form_submissions", {
      form_id: params.form_id,
    });

    revalidatePath("/dashboard/forms");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Save Draft (autosave) ─────────────────────────── */

export async function saveFormDraft(submissionId: string, formData: any) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: submission } = await supabase
      .from("form_submissions")
      .select("organization_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (!submission) return { data: null, error: "Submission not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", submission.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("save_form_draft", {
      p_submission_id: submissionId,
      p_data: formData,
    });

    if (error) {
      logger.error("saveFormDraft RPC error", error.message);
      return { data: null, error: error.message };
    }
    const result = data as { error?: string } | null;
    if (result?.error) return { data: null, error: result.error };

    return { data, error: null };
  } catch (err: any) {
    logger.error("saveFormDraft exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Sign & Lock Submission ────────────────────────── */

export async function signAndLockSubmission(
  submissionId: string,
  signatureData: string,
  documentHash: string,
  metadata?: {
    ip?: string;
    device?: string;
    gps?: { lat: number; lng: number };
  }
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: submission } = await supabase
      .from("form_submissions")
      .select("organization_id")
      .eq("id", submissionId)
      .maybeSingle();
    if (!submission) return { data: null, error: "Submission not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", submission.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("sign_and_lock_submission", {
      p_submission_id: submissionId,
      p_signature: signatureData,
      p_document_hash: documentHash,
      p_metadata: metadata || {},
    });

    if (error) {
      logger.error("signAndLockSubmission RPC error", error.message);
      return { data: null, error: error.message };
    }
    const result = data as { error?: string; missing_fields?: string[] } | null;
    if (result?.error)
      return {
        data: null,
        error: result.error,
        missingFields: result.missing_fields,
      };

    revalidatePath("/dashboard/forms");
    return { data, error: null };
  } catch (err: any) {
    logger.error("signAndLockSubmission exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Verify Document Hash ──────────────────────────── */

export async function verifyDocumentHash(hash: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("verify_document_hash", {
      p_hash: hash,
    });

    if (error) {
      logger.error("verifyDocumentHash RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error("verifyDocumentHash exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Global Template Library ───────────────────────── */

export async function getGlobalFormTemplates(params: {
  orgId: string;
  sector: "TRADES" | "CARE";
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("global_form_templates")
      .select("*")
      .in("sector", [params.sector, "ALL"])
      .order("clone_count", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: (data as GlobalFormTemplate[]) ?? [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function cloneGlobalTemplateToWorkspace(params: {
  globalTemplateId: string;
  orgId: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc("clone_global_template_to_workspace", {
      p_global_template_id: params.globalTemplateId,
      p_organization_id: params.orgId,
    });

    if (error) return { data: null, error: error.message };

    const newTemplateId = typeof data === "string" ? data : null;
    if (!newTemplateId) return { data: null, error: "Failed to clone template" };

    revalidatePath("/dashboard/forms");
    revalidatePath("/dashboard/forms/library");

    return { data: { templateId: newTemplateId }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Forms Overview (stats) ────────────────────────── */

export async function getFormsOverview(
  orgId: string
): Promise<{ data: FormsOverview | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("get_forms_overview", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("getFormsOverview RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data: data as unknown as FormsOverview, error: null };
  } catch (err: any) {
    logger.error("getFormsOverview exception", err.message);
    return { data: null, error: err.message };
  }
}
