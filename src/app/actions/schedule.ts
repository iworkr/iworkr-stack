/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export interface ScheduleBlock {
  id: string;
  organization_id: string;
  job_id: string | null;
  technician_id: string | null;
  title: string;
  client_name: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  status: "scheduled" | "en_route" | "in_progress" | "complete" | "cancelled";
  travel_minutes: number | null;
  is_conflict: boolean;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  technician_name?: string | null;
}

export interface ScheduleEvent {
  id: string;
  organization_id: string;
  user_id: string;
  type: "break" | "meeting" | "personal" | "unavailable";
  title: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export interface BacklogJob {
  id: string;
  display_id: string;
  title: string;
  priority: string;
  location: string | null;
  estimated_duration_minutes: number | null;
  client_name: string | null;
}

export interface Technician {
  id: string;
  full_name: string | null;
  email: string | null;
  hours_booked?: number;
}

export interface CreateScheduleBlockParams {
  organization_id: string;
  job_id?: string | null;
  technician_id: string | null;
  title: string;
  client_name?: string | null;
  location?: string | null;
  start_time: string;
  end_time: string;
  status?: "scheduled" | "en_route" | "in_progress" | "complete" | "cancelled";
  travel_minutes?: number | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}

export interface UpdateScheduleBlockParams {
  job_id?: string | null;
  technician_id?: string | null;
  title?: string;
  client_name?: string | null;
  location?: string | null;
  start_time?: string;
  end_time?: string;
  status?: "scheduled" | "en_route" | "in_progress" | "complete" | "cancelled";
  travel_minutes?: number | null;
  is_conflict?: boolean;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Get all schedule blocks for a date range, organized by technician
 */
export async function getScheduleBlocks(orgId: string, date: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    // Parse date to get start and end of day
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const { data: blocks, error } = await supabase
      .from("schedule_blocks")
      .select(`
        *,
        profiles:technician_id (
          full_name
        )
      `)
      .eq("organization_id", orgId)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    // Format blocks with technician name
    const formattedBlocks = (blocks || []).map((block: any) => ({
      ...block,
      technician_name: block.profiles?.full_name || null,
      profiles: undefined,
    }));

    // Organize by technician
    const blocksByTechnician: Record<string, ScheduleBlock[]> = {};
    
    formattedBlocks.forEach((block: ScheduleBlock) => {
      const techId = block.technician_id || "unassigned";
      if (!blocksByTechnician[techId]) {
        blocksByTechnician[techId] = [];
      }
      blocksByTechnician[techId].push(block);
    });

    return { data: blocksByTechnician, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch schedule blocks" };
  }
}

/**
 * Create a new schedule block with conflict checking
 */
export async function createScheduleBlock(params: CreateScheduleBlockParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Check for conflicts if technician is assigned
    if (params.technician_id) {
      const { data: conflictingBlocks, error: conflictError } = await supabase
        .from("schedule_blocks")
        .select("id")
        .eq("organization_id", params.organization_id)
        .eq("technician_id", params.technician_id)
        .lte("start_time", params.end_time)
        .gte("end_time", params.start_time)
        .neq("status", "cancelled");

      if (conflictError) {
        return { data: null, error: conflictError.message };
      }

      if (conflictingBlocks && conflictingBlocks.length > 0) {
        // Mark as conflict
        const blockData = {
          organization_id: params.organization_id,
          job_id: params.job_id || null,
          technician_id: params.technician_id,
          title: params.title,
          client_name: params.client_name || null,
          location: params.location || null,
          start_time: params.start_time,
          end_time: params.end_time,
          status: params.status || "scheduled",
          travel_minutes: params.travel_minutes || null,
          is_conflict: true,
          notes: params.notes || null,
          metadata: params.metadata || null,
        };

        const { data: block, error: insertError } = await supabase
          .from("schedule_blocks")
          .insert(blockData)
          .select()
          .single();

        if (insertError) {
          return { data: null, error: insertError.message };
        }

        revalidatePath("/dashboard/schedule");
        return { data: block, error: null };
      }
    }

    // No conflict, create normally
    const blockData = {
      organization_id: params.organization_id,
      job_id: params.job_id || null,
      technician_id: params.technician_id,
      title: params.title,
      client_name: params.client_name || null,
      location: params.location || null,
      start_time: params.start_time,
      end_time: params.end_time,
      status: params.status || "scheduled",
      travel_minutes: params.travel_minutes || null,
      is_conflict: false,
      notes: params.notes || null,
      metadata: params.metadata || null,
    };

    const { data: block, error: insertError } = await supabase
      .from("schedule_blocks")
      .insert(blockData)
      .select()
      .single();

    if (insertError) {
      return { data: null, error: insertError.message };
    }

    revalidatePath("/dashboard/schedule");
    return { data: block, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create schedule block" };
  }
}

/**
 * Update a schedule block
 */
export async function updateScheduleBlock(blockId: string, updates: UpdateScheduleBlockParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Get current block to check for conflict updates
    const { data: currentBlock, error: fetchError } = await supabase
      .from("schedule_blocks")
      .select("organization_id, technician_id, start_time, end_time")
      .eq("id", blockId)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    // Check for conflicts if times or technician changed
    const startTime = updates.start_time || currentBlock.start_time;
    const endTime = updates.end_time || currentBlock.end_time;
    const technicianId = updates.technician_id !== undefined ? updates.technician_id : currentBlock.technician_id;

    let isConflict = updates.is_conflict;
    if (technicianId && (updates.start_time || updates.end_time || updates.technician_id !== undefined)) {
      const { data: conflictingBlocks, error: conflictError } = await supabase
        .from("schedule_blocks")
        .select("id")
        .eq("organization_id", currentBlock.organization_id)
        .eq("technician_id", technicianId)
        .lte("start_time", endTime)
        .gte("end_time", startTime)
        .neq("id", blockId)
        .neq("status", "cancelled");

      if (conflictError) {
        return { data: null, error: conflictError.message };
      }

      isConflict = conflictingBlocks && conflictingBlocks.length > 0;
    }

    const updateData: any = {};
    if (updates.job_id !== undefined) updateData.job_id = updates.job_id;
    if (updates.technician_id !== undefined) updateData.technician_id = updates.technician_id;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.client_name !== undefined) updateData.client_name = updates.client_name;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
    if (updates.end_time !== undefined) updateData.end_time = updates.end_time;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.travel_minutes !== undefined) updateData.travel_minutes = updates.travel_minutes;
    if (updates.is_conflict !== undefined) updateData.is_conflict = updates.is_conflict;
    else if (isConflict !== undefined) updateData.is_conflict = isConflict;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    updateData.updated_at = new Date().toISOString();

    const { data: block, error } = await supabase
      .from("schedule_blocks")
      .update(updateData)
      .eq("id", blockId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/schedule");
    return { data: block, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update schedule block" };
  }
}

/**
 * Delete a schedule block
 */
export async function deleteScheduleBlock(blockId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("schedule_blocks")
      .delete()
      .eq("id", blockId);

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/schedule");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to delete schedule block" };
  }
}

/**
 * Get all technicians for an organization
 */
export async function getOrgTechnicians(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: members, error } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        profiles:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq("organization_id", orgId)
      .eq("role", "technician");

    if (error) {
      return { data: null, error: error.message };
    }

    const technicians = (members || [])
      .map((member: any) => ({
        id: member.profiles?.id || member.user_id,
        full_name: member.profiles?.full_name || null,
        email: member.profiles?.email || null,
      }))
      .filter((tech: Technician) => tech.id);

    return { data: technicians, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch technicians" };
  }
}

/* ── Schedule View (RPC-backed) ────────────────────────── */

/**
 * Get full schedule view: technicians, blocks, events, and backlog in one RPC call
 */
export async function getScheduleView(orgId: string, date: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_schedule_view", {
      p_org_id: orgId,
      p_date: date,
    });

    if (error) {
      logger.error("get_schedule_view RPC failed", "schedule", undefined, { error: error.message });
      // Fallback to separate queries
      return getScheduleBlocksFallback(orgId, date);
    }

    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch schedule view", "schedule", error);
    return { data: null, error: error.message || "Failed to fetch schedule view" };
  }
}

async function getScheduleBlocksFallback(orgId: string, date: string) {
  const [blocksResult, techResult, backlogResult] = await Promise.all([
    getScheduleBlocks(orgId, date),
    getOrgTechnicians(orgId),
    getBacklogJobs(orgId),
  ]);

  const allBlocks: ScheduleBlock[] = [];
  if (blocksResult.data) {
    Object.values(blocksResult.data).forEach((techBlocks: any) => {
      if (Array.isArray(techBlocks)) allBlocks.push(...techBlocks);
    });
  }

  return {
    data: {
      technicians: techResult.data || [],
      blocks: allBlocks,
      events: [],
      backlog: backlogResult.data || [],
    },
    error: null,
  };
}

/* ── Drag & Drop Persistence ───────────────────────────── */

/**
 * Move/reschedule a block via RPC (the "snap" mutation)
 */
export async function moveScheduleBlockServer(
  blockId: string,
  technicianId: string,
  startTime: string,
  endTime: string
) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("move_schedule_block", {
      p_block_id: blockId,
      p_technician_id: technicianId,
      p_start_time: startTime,
      p_end_time: endTime,
    });

    if (error) {
      logger.error("move_schedule_block RPC failed, falling back", "schedule", undefined, { error: error.message });

      // Direct update fallback
      const { error: updateError } = await supabase
        .from("schedule_blocks")
        .update({
          technician_id: technicianId,
          start_time: startTime,
          end_time: endTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", blockId);

      if (updateError) return { data: null, error: updateError.message };
      return { data: { success: true, conflict: false, block_id: blockId }, error: null };
    }

    revalidatePath("/dashboard/schedule");
    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to move schedule block", "schedule", error);
    return { data: null, error: error.message || "Failed to move block" };
  }
}

/**
 * Resize a block (update end_time)
 */
export async function resizeScheduleBlockServer(blockId: string, endTime: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("schedule_blocks")
      .update({ end_time: endTime, updated_at: new Date().toISOString() })
      .eq("id", blockId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/schedule");
    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to resize schedule block", "schedule", error);
    return { data: null, error: error.message || "Failed to resize block" };
  }
}

/**
 * Assign a backlog job to the schedule via RPC
 */
export async function assignJobToSchedule(
  orgId: string,
  jobId: string,
  technicianId: string,
  startTime: string,
  endTime: string
) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("assign_job_to_schedule", {
      p_org_id: orgId,
      p_job_id: jobId,
      p_technician_id: technicianId,
      p_start_time: startTime,
      p_end_time: endTime,
    });

    if (error) {
      logger.error("assign_job_to_schedule RPC failed", "schedule", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/jobs");
    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to assign job to schedule", "schedule", error);
    return { data: null, error: error.message || "Failed to assign job" };
  }
}

/* ── Backlog Jobs ──────────────────────────────────────── */

/**
 * Get unscheduled backlog jobs
 */
export async function getBacklogJobs(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        id,
        display_id,
        title,
        priority,
        location,
        estimated_duration_minutes,
        clients:client_id (name)
      `)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("assignee_id", null)
      .in("status", ["backlog", "todo"])
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };

    const backlog: BacklogJob[] = (data || []).map((j: any) => ({
      id: j.id,
      display_id: j.display_id,
      title: j.title,
      priority: j.priority,
      location: j.location,
      estimated_duration_minutes: j.estimated_duration_minutes,
      client_name: j.clients?.name || null,
    }));

    return { data: backlog, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch backlog jobs", "schedule", error);
    return { data: null, error: error.message || "Failed to fetch backlog" };
  }
}

/* ── Schedule Events CRUD ──────────────────────────────── */

export interface CreateScheduleEventParams {
  organization_id: string;
  user_id: string;
  type: "break" | "meeting" | "personal" | "unavailable";
  title: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}

/**
 * Get schedule events for a date
 */
export async function getScheduleEvents(orgId: string, date: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("schedule_events")
      .select(`
        *,
        profiles:user_id (full_name)
      `)
      .eq("organization_id", orgId)
      .gte("start_time", startDate.toISOString())
      .lte("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    if (error) return { data: null, error: error.message };

    const events: ScheduleEvent[] = (data || []).map((e: any) => ({
      ...e,
      user_name: e.profiles?.full_name || null,
      profiles: undefined,
    }));

    return { data: events, error: null };
  } catch (error: any) {
    logger.error("Failed to fetch schedule events", "schedule", error);
    return { data: null, error: error.message || "Failed to fetch events" };
  }
}

/**
 * Create a schedule event
 */
export async function createScheduleEvent(params: CreateScheduleEventParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        organization_id: params.organization_id,
        user_id: params.user_id,
        type: params.type,
        title: params.title,
        start_time: params.start_time,
        end_time: params.end_time,
        notes: params.notes || null,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/schedule");
    return { data, error: null };
  } catch (error: any) {
    logger.error("Failed to create schedule event", "schedule", error);
    return { data: null, error: error.message || "Failed to create event" };
  }
}

/**
 * Delete a schedule event
 */
export async function deleteScheduleEvent(eventId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("id", eventId);

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/schedule");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    logger.error("Failed to delete schedule event", "schedule", error);
    return { data: null, error: error.message || "Failed to delete event" };
  }
}

/* ── Conflict Check ────────────────────────────────────── */

/**
 * Check for schedule conflicts via RPC
 */
export async function checkScheduleConflicts(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("check_schedule_conflicts", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("check_schedule_conflicts RPC failed", "schedule", undefined, { error: error.message });
      return { data: [], error: null };
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    logger.error("Failed to check conflicts", "schedule", error);
    return { data: [], error: error.message || "Failed to check conflicts" };
  }
}
