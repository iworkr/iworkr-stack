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

/* ── Types ─────────────────────────────────────────── */

export interface FormsOverview {
  total_templates: number;
  published_templates: number;
  total_submissions: number;
  signed_submissions: number;
  pending_submissions: number;
  expired_submissions: number;
}

/* ── Forms CRUD ────────────────────────────────────── */

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

    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getForm(formId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("forms")
      .select("*")
      .eq("id", formId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Form not found" };

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

export async function createForm(params: {
  organization_id: string;
  title: string;
  description?: string;
  category?: string;
  blocks?: any[];
}) {
  try {
    // Validate input
    const validated = validate(CreateFormSchema, params);
    if (validated.error) return { data: null, error: validated.error };

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

    const { data, error } = await supabase
      .from("forms")
      .insert({
        ...params,
        created_by: user?.id,
        status: "draft",
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
    // Validate input
    const validated = validate(UpdateFormSchema, updates);
    if (validated.error) return { data: null, error: validated.error };

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

    const { data, error } = await supabase
      .from("forms")
      .update(updates as any)
      .eq("id", formId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/forms");
    return { data, error: null };
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

    const { data, error } = await supabase.rpc("publish_form", {
      p_form_id: formId,
    });

    if (error) {
      logger.error("publishForm RPC error", error.message);
      return { data: null, error: error.message };
    }
    const result = data as { error?: string } | null;
    if (result?.error) return { data: null, error: result.error };

    revalidatePath("/dashboard/forms");
    return { data, error: null };
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
        forms:form_id (title, category)
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
        forms:form_id (title, category, blocks, version)
      `
      )
      .eq("id", submissionId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user!.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("form_submissions")
      .insert({
        ...params,
        submitted_by: user?.id,
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

/* ── Forms Overview (stats) ────────────────────────── */

export async function getFormsOverview(
  orgId: string
): Promise<{ data: FormsOverview | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

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
