/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Helpers ──────────────────────────────────────────────── */
async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ══════════════════════════════════════════════════════════════
   SWMS TEMPLATES CRUD
   ══════════════════════════════════════════════════════════════ */

export async function getSwmsTemplates(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("swms_templates")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function createSwmsTemplate(orgId: string, input: {
  title: string;
  trade_category?: string;
  default_hazards?: any[];
  required_ppe?: string[];
}) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("swms_templates")
      .insert({
        organization_id: orgId,
        title: input.title,
        trade_category: input.trade_category || null,
        default_hazards: input.default_hazards || [],
        required_ppe: input.required_ppe || [],
        status: "DRAFT",
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/safety");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateSwmsTemplate(templateId: string, orgId: string, updates: {
  title?: string;
  trade_category?: string;
  default_hazards?: any[];
  required_ppe?: string[];
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("swms_templates")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/safety");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function publishSwmsTemplate(templateId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("swms_templates")
      .update({
        status: "PUBLISHED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard/safety");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   RISK MATRICES
   ══════════════════════════════════════════════════════════════ */

export async function getRiskMatrix(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("risk_matrices")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function upsertRiskMatrix(orgId: string, matrixConfig: Record<string, unknown>) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    // Check if one already exists
    const { data: existing } = await (supabase as any)
      .from("risk_matrices")
      .select("id")
      .eq("organization_id", orgId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await (supabase as any)
        .from("risk_matrices")
        .update({
          matrix_config: matrixConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      revalidatePath("/dashboard/safety");
      return { data, error: null };
    } else {
      const { data, error } = await (supabase as any)
        .from("risk_matrices")
        .insert({
          organization_id: orgId,
          matrix_config: matrixConfig,
        })
        .select()
        .single();
      if (error) throw error;
      revalidatePath("/dashboard/safety");
      return { data, error: null };
    }
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   SWMS RECORDS (On-site Assessment)
   ══════════════════════════════════════════════════════════════ */

export async function verifyGeofence(orgId: string, jobId: string, deviceLat: number, deviceLng: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("verify_swms_geofence", {
      p_device_lat: deviceLat,
      p_device_lng: deviceLng,
      p_job_id: jobId,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function createSwmsRecord(input: {
  orgId: string;
  jobId: string;
  templateId?: string;
  assessed_hazards?: any[];
  initial_risk_scores?: any[];
  mitigations_applied?: any[];
  residual_risk_scores?: any[];
  ppe_confirmed?: string[];
  site_conditions_assessed?: Record<string, boolean>;
  final_risk_score?: number;
  highest_residual_risk?: string;
  stop_work_triggered?: boolean;
  stop_work_reason?: string;
  geofence_passed?: boolean;
  distance_from_site_meters?: number;
  device_lat?: number;
  device_lng?: number;
  device_model?: string;
  device_os?: string;
  app_version?: string;
}) {
  try {
    const { supabase, user } = await assertOrgMember(input.orgId);
    const insertPayload: any = {
      organization_id: input.orgId,
      job_id: input.jobId,
      template_id: input.templateId || null,
      worker_id: user.id,
      assessed_hazards: input.assessed_hazards || [],
      initial_risk_scores: input.initial_risk_scores || [],
      mitigations_applied: input.mitigations_applied || [],
      residual_risk_scores: input.residual_risk_scores || [],
      ppe_confirmed: input.ppe_confirmed || [],
      site_conditions_assessed: input.site_conditions_assessed || {},
      final_risk_score: input.final_risk_score ?? null,
      highest_residual_risk: input.highest_residual_risk || null,
      stop_work_triggered: input.stop_work_triggered || false,
      stop_work_reason: input.stop_work_reason || null,
      geofence_passed: input.geofence_passed || false,
      distance_from_site_meters: input.distance_from_site_meters ?? null,
      device_model: input.device_model || null,
      device_os: input.device_os || null,
      app_version: input.app_version || null,
      status: "IN_PROGRESS",
    };
    // Set lat/lng as PostGIS geography points
    if (input.device_lat && input.device_lng) {
      insertPayload.lat_lng_captured = `SRID=4326;POINT(${input.device_lng} ${input.device_lat})`;
    }
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;
    revalidatePath(`/dashboard/jobs/${input.jobId}`);
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateSwmsRecord(recordId: string, orgId: string, updates: {
  assessed_hazards?: any[];
  initial_risk_scores?: any[];
  mitigations_applied?: any[];
  residual_risk_scores?: any[];
  ppe_confirmed?: string[];
  site_conditions_assessed?: Record<string, boolean>;
  final_risk_score?: number;
  highest_residual_risk?: string;
  stop_work_triggered?: boolean;
  stop_work_reason?: string;
  status?: string;
  notes?: string;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function completeSwmsRecord(recordId: string, orgId: string, payload?: {
  assessed_hazards?: any[];
  initial_risk_scores?: any[];
  mitigations_applied?: any[];
  residual_risk_scores?: any[];
  ppe_confirmed?: string[];
  site_conditions_assessed?: Record<string, boolean>;
  final_risk_score?: number;
  highest_residual_risk?: string;
}) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const updateData: any = {
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (payload) {
      Object.assign(updateData, payload);
    }

    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .update(updateData)
      .eq("id", recordId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function triggerStopWork(recordId: string, orgId: string, reason: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .update({
        stop_work_triggered: true,
        stop_work_reason: reason,
        status: "STOP_WORK_TRIGGERED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;
    revalidatePath("/dashboard");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getSwmsRecordsForJob(jobId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .select("*")
      .eq("job_id", jobId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function getSwmsRecordDetail(recordId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data: record, error: recErr } = await (supabase as any)
      .from("job_swms_records")
      .select("*")
      .eq("id", recordId)
      .eq("organization_id", orgId)
      .single();
    if (recErr) throw recErr;
    if (!record) throw new Error("SWMS record not found");

    const { data: signatures, error: sigErr } = await (supabase as any)
      .from("job_swms_signatures")
      .select("*")
      .eq("record_id", recordId)
      .order("signed_at", { ascending: true });
    if (sigErr) throw sigErr;

    return { data: { ...record, signatures: signatures || [] }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   SIGNATURES
   ══════════════════════════════════════════════════════════════ */

export async function addSwmsSignature(recordId: string, orgId: string, signatureSvg: string, workerName: string) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    // Insert signature
    const { data: sig, error: sigErr } = await (supabase as any)
      .from("job_swms_signatures")
      .insert({
        record_id: recordId,
        worker_id: user.id,
        worker_name: workerName,
        signature_svg: signatureSvg,
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (sigErr) throw sigErr;

    // Check how many signatures exist — if ≥ 1, mark as SIGNED
    const { data: allSigs } = await (supabase as any)
      .from("job_swms_signatures")
      .select("id")
      .eq("record_id", recordId);

    const sigCount = (allSigs || []).length;

    // Mark record as SIGNED once at least one worker signs
    if (sigCount >= 1) {
      await (supabase as any)
        .from("job_swms_records")
        .update({
          status: "SIGNED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId)
        .eq("organization_id", orgId);
    }

    revalidatePath("/dashboard");
    return { data: sig, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getSignaturesForRecord(recordId: string, orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("job_swms_signatures")
      .select("*")
      .eq("record_id", recordId)
      .order("signed_at", { ascending: true });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   COMPLIANCE DASHBOARD
   ══════════════════════════════════════════════════════════════ */

export async function getSafetyComplianceStats(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any).rpc("get_safety_compliance_stats", {
      p_org_id: orgId,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getRecentSwmsRecords(orgId: string, limit?: number) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .select("*, jobs:job_id(id, title)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit || 20);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function getStopWorkAlerts(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await (supabase as any)
      .from("job_swms_records")
      .select("*, jobs:job_id(id, title)")
      .eq("organization_id", orgId)
      .eq("stop_work_triggered", true)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════
   PDF TRIGGER
   ══════════════════════════════════════════════════════════════ */

export async function triggerSwmsPdfGeneration(recordId: string, orgId: string) {
  try {
    const { supabase, role } = await assertOrgMember(orgId);
    if (!["owner", "admin", "manager"].includes(role)) {
      throw new Error("Insufficient permissions to generate PDF");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error("Supabase configuration missing for PDF generation");
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-swms-pdf`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        record_id: recordId,
        organization_id: orgId,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`PDF generation failed: ${errBody}`);
    }

    const result = await res.json();

    // Update record with PDF URL if returned
    if (result.pdf_url) {
      await (supabase as any)
        .from("job_swms_records")
        .update({
          pdf_url: result.pdf_url,
          pdf_storage_path: result.pdf_storage_path || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", recordId)
        .eq("organization_id", orgId);
    }

    revalidatePath("/dashboard");
    return { data: result, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}
