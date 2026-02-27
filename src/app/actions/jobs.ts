/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Events, dispatch } from "@/lib/automation";
import { createJobSchema, updateJobSchema, validate } from "@/lib/validation";
import { logger } from "@/lib/logger";

export interface Job {
  id: string;
  organization_id: string;
  display_id: string;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "done" | "cancelled" | "urgent";
  priority: "urgent" | "high" | "medium" | "low" | "none";
  client_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  labels: string[];
  revenue: number | null;
  cost: number | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  metadata: Record<string, any> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_name?: string | null;
  assignee_name?: string | null;
  subtask_count?: number;
}

export interface JobSubtask {
  id: string;
  job_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface JobActivity {
  id: string;
  job_id: string;
  type: "status_change" | "comment" | "photo" | "invoice" | "creation" | "assignment" | "note";
  text: string | null;
  user_id: string | null;
  user_name: string | null;
  photos: string[];
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface JobLineItem {
  id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  sort_order: number;
  created_at: string;
}

export interface CreateJobLineItemInput {
  description: string;
  quantity?: number;
  unit_price_cents: number;
}

export interface CreateJobParams {
  organization_id: string;
  title: string;
  description?: string | null;
  status?: "backlog" | "todo" | "in_progress" | "done" | "cancelled" | "urgent";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  client_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  labels?: string[];
  revenue?: number | null;
  cost?: number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  metadata?: Record<string, any> | null;
  line_items?: CreateJobLineItemInput[];
}

export interface UpdateJobParams {
  title?: string;
  description?: string | null;
  status?: "backlog" | "todo" | "in_progress" | "done" | "cancelled" | "urgent";
  priority?: "urgent" | "high" | "medium" | "low" | "none";
  client_id?: string | null;
  assignee_id?: string | null;
  due_date?: string | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  labels?: string[];
  revenue?: number | null;
  cost?: number | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  metadata?: Record<string, any> | null;
}

/**
 * Get all jobs for an organization
 */
export async function getJobs(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: jobs, error } = await supabase
      .from("jobs")
      .select(`
        *,
        clients:client_id (
          name
        ),
        profiles:assignee_id (
          full_name
        ),
        job_subtasks (
          id
        )
      `)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    const formattedJobs = jobs.map((job: any) => ({
      ...job,
      client_name: job.clients?.name || null,
      assignee_name: job.profiles?.full_name || null,
      subtask_count: job.job_subtasks?.length || 0,
      clients: undefined,
      profiles: undefined,
      job_subtasks: undefined,
    }));

    return { data: formattedJobs, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch jobs", "jobs", error);
    return { data: null, error: error.message || "Failed to fetch jobs" };
  }
}

/**
 * Get a single job with full details
 */
export async function getJob(jobId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: job, error } = await supabase
      .from("jobs")
      .select(`
        *,
        clients:client_id (
          name
        ),
        profiles:assignee_id (
          full_name
        ),
        job_subtasks (
          *
        ),
        job_activity (
          *
        )
      `)
      .eq("id", jobId)
      .is("deleted_at", null)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    const rawJob = job as Record<string, unknown>;
    const formattedJob = {
      ...job,
      client_name: (rawJob.clients as any)?.name || null,
      assignee_name: (rawJob.profiles as any)?.full_name || null,
      job_subtasks: ((job.job_subtasks || []) as JobSubtask[]).sort((a: JobSubtask, b: JobSubtask) =>
        a.sort_order - b.sort_order
      ),
      job_activity: ((job.job_activity || []) as JobActivity[]).sort((a: JobActivity, b: JobActivity) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      clients: undefined,
      profiles: undefined,
    };

    return { data: formattedJob, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch job" };
  }
}

/**
 * Create a new job — uses RPC for transactional creation with line items
 */
export async function createJob(params: CreateJobParams) {
  try {
    // Validate input
    const validated = validate(createJobSchema, params);
    if (validated.error) {
      return { data: null, error: validated.error };
    }

    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const lineItems = (params.line_items || []).map((li) => ({
      description: li.description,
      quantity: li.quantity || 1,
      unit_price_cents: li.unit_price_cents,
    }));

    // Use RPC for transactional create with line items
    const { data: result, error: rpcError } = await supabase.rpc("create_job_with_estimate", {
      p_org_id: params.organization_id,
      p_title: params.title,
      p_description: params.description || null,
      p_status: params.status || "backlog",
      p_priority: params.priority || "none",
      p_client_id: params.client_id ?? undefined,
      p_assignee_id: params.assignee_id ?? undefined,
      p_due_date: params.due_date ?? undefined,
      p_location: params.location ?? undefined,
      p_location_lat: params.location_lat ?? undefined,
      p_location_lng: params.location_lng ?? undefined,
      p_labels: params.labels || [],
      p_revenue: params.revenue || 0,
      p_line_items: JSON.stringify(lineItems),
    } as any);

    if (rpcError) {
      logger.error("RPC create_job_with_estimate failed", "jobs", undefined, { error: rpcError.message });

      // Fallback to direct insert (without line items) if RPC fails
      return await createJobDirect(params, user, supabase);
    }

    const rpcResult = result as Record<string, unknown>;
    // Dispatch automation event
    dispatch(Events.jobCreated(params.organization_id, rpcResult.id as string, {
      display_id: rpcResult.display_id as string,
      title: params.title,
      status: params.status || "backlog",
      priority: params.priority || "none",
      client_id: params.client_id,
      assignee_id: params.assignee_id,
    }));

    // Fetch the full job to return
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", rpcResult.id as string)
      .single();

    revalidatePath("/dashboard/jobs");
    return { data: job || result, error: null };
  } catch (error: any) {
    logger.error("Failed to create job", "jobs", error);
    return { data: null, error: error.message || "Failed to create job" };
  }
}

/**
 * Direct insert fallback when RPC is not available
 */
async function createJobDirect(params: CreateJobParams, user: any, supabase: any) {
  try {
    const jobData = {
      organization_id: params.organization_id,
      title: params.title,
      description: params.description || null,
      status: params.status || "backlog",
      priority: params.priority || "none",
      client_id: params.client_id || null,
      assignee_id: params.assignee_id || null,
      due_date: params.due_date || null,
      location: params.location || null,
      location_lat: params.location_lat || null,
      location_lng: params.location_lng || null,
      labels: params.labels || [],
      revenue: params.revenue || null,
      cost: params.cost || null,
      estimated_hours: params.estimated_hours || null,
      actual_hours: params.actual_hours || null,
      metadata: params.metadata || null,
      created_by: user.id,
    };

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert(jobData)
      .select()
      .single();

    if (jobError) return { data: null, error: jobError.message };

    // Insert line items if any
    if (params.line_items && params.line_items.length > 0) {
      const lineItemRows = params.line_items.map((li, idx) => ({
        job_id: job.id,
        description: li.description,
        quantity: li.quantity || 1,
        unit_price_cents: li.unit_price_cents,
        sort_order: idx,
      }));

      await supabase.from("job_line_items").insert(lineItemRows);
    }

    revalidatePath("/dashboard/jobs");
    return { data: job, error: null };
  } catch (error: any) {
    logger.error("Failed to create job (fallback)", "jobs", error);
    return { data: null, error: error.message || "Failed to create job" };
  }
}

/**
 * Update a job
 */
export async function updateJob(jobId: string, updates: UpdateJobParams) {
  try {
    // Validate input
    const validated = validate(updateJobSchema, updates);
    if (validated.error) {
      return { data: null, error: validated.error };
    }

    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Get current job to check status change
    const { data: currentJob, error: fetchError } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    const { data: job, error: updateError } = await supabase
      .from("jobs")
      .update(updates as any)
      .eq("id", jobId)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Create status_change activity if status changed
    if (updates.status && updates.status !== currentJob.status) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userName = currentUser?.user_metadata?.full_name || currentUser?.email || "Unknown";

      await supabase
        .from("job_activity")
        .insert({
          job_id: jobId,
          type: "status_change",
          text: `Status changed from ${currentJob.status} to ${updates.status}`,
          user_id: user.id,
          user_name: userName,
          photos: [],
          metadata: { old_status: currentJob.status, new_status: updates.status },
        });

      // Dispatch automation events for status changes
      dispatch(Events.jobStatusChange(
        job.organization_id, jobId, currentJob.status!, updates.status, user.id
      ));

      // Special event for completion
      if (updates.status === "done") {
        dispatch(Events.jobCompleted(job.organization_id, jobId, {
          title: job.title,
          client_id: job.client_id,
          revenue: job.revenue,
          new_status: "done",
        }));
      }
    }

    revalidatePath("/dashboard/jobs");
    return { data: job, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update job" };
  }
}

/**
 * Soft delete a job
 */
export async function deleteJob(jobId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("jobs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", jobId);

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/jobs");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete job" };
  }
}

/**
 * Create a subtask for a job
 */
export async function createSubtask(jobId: string, title: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Get max sort_order for this job
    const { data: existingSubtasks } = await supabase
      .from("job_subtasks")
      .select("sort_order")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const sortOrder = existingSubtasks && existingSubtasks.length > 0
      ? (existingSubtasks[0].sort_order ?? 0) + 1
      : 0;

    const { data: subtask, error } = await supabase
      .from("job_subtasks")
      .insert({
        job_id: jobId,
        title,
        completed: false,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/jobs");
    return { data: subtask, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create subtask" };
  }
}

/**
 * Toggle subtask completion
 */
export async function toggleSubtask(subtaskId: string, completed: boolean) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { data: subtask, error } = await supabase
      .from("job_subtasks")
      .update({ completed })
      .eq("id", subtaskId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/jobs");
    return { data: subtask, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to toggle subtask" };
  }
}

/**
 * Delete a subtask
 */
export async function deleteSubtask(subtaskId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("job_subtasks")
      .delete()
      .eq("id", subtaskId);

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/jobs");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete subtask" };
  }
}

/**
 * Add activity to a job
 */
export async function addJobActivity(
  jobId: string,
  type: "status_change" | "comment" | "photo" | "invoice" | "creation" | "assignment" | "note",
  text: string | null = null,
  userId?: string | null,
  photos?: string[]
) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const activityUserId = userId || user.id;
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";

    const { data: activity, error } = await supabase
      .from("job_activity")
      .insert({
        job_id: jobId,
        type,
        text: text || "",
        user_id: activityUserId,
        user_name: userName,
        photos: photos || [],
        metadata: null,
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/jobs");
    return { data: activity, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to add activity" };
  }
}

/**
 * Assign a job to a user
 */
export async function assignJob(jobId: string, assigneeId: string | null, assigneeName: string | null) {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { data: job, error: updateError } = await supabase
      .from("jobs")
      .update({ assignee_id: assigneeId })
      .eq("id", jobId)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Create assignment activity
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const userName = currentUser?.user_metadata?.full_name || currentUser?.email || "Unknown";

    const assignmentText = assigneeId
      ? `Job assigned to ${assigneeName || "Unknown"}`
      : "Job assignment removed";

    await supabase
      .from("job_activity")
      .insert({
        job_id: jobId,
        type: "assignment",
        text: assignmentText,
        user_id: user.id,
        user_name: userName,
        photos: [],
        metadata: { assignee_id: assigneeId, assignee_name: assigneeName },
      });

    // Dispatch automation event
    if (assigneeId) {
      dispatch(Events.jobAssigned(
        job.organization_id, jobId, assigneeId, assigneeName || ""
      ));
    }

    revalidatePath("/dashboard/jobs");
    return { data: job, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to assign job" };
  }
}

/* ── Line Items ─────────────────────────────────────────── */

/**
 * Get line items for a job
 */
export async function getJobLineItems(jobId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("job_line_items")
      .select("*")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as JobLineItem[], error: null };
  } catch (error: any) {
    logger.error("Failed to fetch job line items", "jobs", error);
    return { data: null, error: error.message || "Failed to fetch line items" };
  }
}

/**
 * Add a line item to a job
 */
export async function addJobLineItem(jobId: string, input: CreateJobLineItemInput) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Get next sort order
    const { data: existing } = await supabase
      .from("job_line_items")
      .select("sort_order")
      .eq("job_id", jobId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from("job_line_items")
      .insert({
        job_id: jobId,
        description: input.description,
        quantity: input.quantity || 1,
        unit_price_cents: input.unit_price_cents,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/jobs");
    return { data: data as JobLineItem, error: null };
  } catch (error: any) {
    logger.error("Failed to add line item", "jobs", error);
    return { data: null, error: error.message || "Failed to add line item" };
  }
}

/**
 * Update a line item
 */
export async function updateJobLineItem(
  lineItemId: string,
  updates: { description?: string; quantity?: number; unit_price_cents?: number }
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("job_line_items")
      .update(updates)
      .eq("id", lineItemId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/jobs");
    return { data: data as JobLineItem, error: null };
  } catch (error: any) {
    logger.error("Failed to update line item", "jobs", error);
    return { data: null, error: error.message || "Failed to update line item" };
  }
}

/**
 * Delete a line item
 */
export async function deleteJobLineItem(lineItemId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await supabase
      .from("job_line_items")
      .delete()
      .eq("id", lineItemId);

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/jobs");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    logger.error("Failed to delete line item", "jobs", error);
    return { data: null, error: error.message || "Failed to delete line item" };
  }
}

/* ── Filtered Jobs (RPC-backed) ─────────────────────────── */

export interface JobFilters {
  status?: string | null;
  priority?: string | null;
  assignee_id?: string | null;
  search?: string | null;
  labels?: string[] | null;
  limit?: number;
  offset?: number;
}

/**
 * Get filtered & sorted jobs via RPC with advanced filtering
 */
export async function getFilteredJobs(orgId: string, filters: JobFilters = {}) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_filtered_jobs", {
      p_org_id: orgId,
      p_status: filters.status ?? undefined,
      p_priority: filters.priority ?? undefined,
      p_assignee_id: filters.assignee_id ?? undefined,
      p_search: filters.search ?? undefined,
      p_labels: filters.labels ?? undefined,
      p_limit: filters.limit || 100,
      p_offset: filters.offset || 0,
    } as any);

    if (error) {
      logger.error("get_filtered_jobs RPC failed, falling back", "jobs", undefined, { error: error.message });
      return getJobs(orgId);
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    logger.error("Failed to fetch filtered jobs", "jobs", error);
    return { data: null, error: error.message || "Failed to fetch filtered jobs" };
  }
}

/**
 * Get full job details via RPC (includes line items, subtasks, activity)
 */
export async function getJobDetails(jobId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_job_details", {
      p_job_id: jobId,
    });

    if (error) {
      logger.error("get_job_details RPC failed, falling back", "jobs", undefined, { error: error.message });
      return getJob(jobId);
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch job details", "jobs", error);
    return { data: null, error: error.message || "Failed to fetch job details" };
  }
}
