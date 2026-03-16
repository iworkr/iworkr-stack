"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CreateCoordinationEntrySchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  start_time: z.string(),
  end_time: z.string(),
  ndis_line_item: z.string().min(3).max(80),
  hourly_rate: z.number().min(0),
  activity_type: z.enum(["phone", "email", "research", "meeting", "report_writing", "travel", "other"]),
  case_note: z.string().min(30).max(8000),
  status: z.enum(["draft", "unbilled", "invoiced", "paid"]).default("unbilled").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UpdateCoordinationEntrySchema = z.object({
  id: z.string().uuid(),
  case_note: z.string().min(30).max(8000).optional(),
  activity_type: z.enum(["phone", "email", "research", "meeting", "report_writing", "travel", "other"]).optional(),
});

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listCoordinationEntriesAction(input: {
  organization_id: string;
  coordinator_id?: string;
  participant_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  limit?: number;
}) {
  const { supabase, user } = await requireUser();
  let query = (supabase as any)
    .from("coordination_time_entries")
    .select("*, participant_profiles(preferred_name, full_name, clients(name), ndis_number)")
    .eq("organization_id", input.organization_id)
    .order("start_time", { ascending: false })
    .limit(input.limit || 250);

  if (input.coordinator_id) query = query.eq("coordinator_id", input.coordinator_id);
  else query = query.eq("coordinator_id", user.id);

  if (input.participant_id) query = query.eq("participant_id", input.participant_id);
  if (input.status) query = query.eq("status", input.status);
  if (input.date_from) query = query.gte("start_time", input.date_from);
  if (input.date_to) query = query.lte("start_time", input.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCoordinationEntryAction(input: z.infer<typeof CreateCoordinationEntrySchema>) {
  const parsed = CreateCoordinationEntrySchema.parse(input);
  const { supabase } = await requireUser();

  const { data, error } = await (supabase as any).rpc("create_coordination_time_entry", {
    p_organization_id: parsed.organization_id,
    p_participant_id: parsed.participant_id,
    p_start_time: parsed.start_time,
    p_end_time: parsed.end_time,
    p_ndis_line_item: parsed.ndis_line_item,
    p_hourly_rate: parsed.hourly_rate,
    p_activity_type: parsed.activity_type,
    p_case_note: parsed.case_note,
    p_metadata: parsed.metadata ?? {},
  });

  if (error) throw new Error(error.message);

  // If draft status requested, update the entry after creation
  if (parsed.status === "draft" && data) {
    const entryId = typeof data === "object" ? data.id : data;
    if (entryId) {
      await (supabase as any)
        .from("coordination_time_entries")
        .update({ status: "draft" })
        .eq("id", entryId);
    }
  }
  revalidatePath("/dashboard/coordination/ledger");
  revalidatePath(`/dashboard/care/participants/${parsed.participant_id}`);
  return data;
}

export async function updateCoordinationEntryAction(input: z.infer<typeof UpdateCoordinationEntrySchema>) {
  const parsed = UpdateCoordinationEntrySchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data, error } = await (supabase as any)
    .from("coordination_time_entries")
    .update({
      ...(parsed.case_note !== undefined ? { case_note: parsed.case_note } : {}),
      ...(parsed.activity_type !== undefined ? { activity_type: parsed.activity_type } : {}),
    })
    .eq("id", parsed.id)
    .eq("coordinator_id", user.id)
    .eq("status", "unbilled")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/coordination/ledger");
  return data;
}

export async function listCoordinationParticipantsAction(organizationId: string, search?: string) {
  const { supabase } = await requireUser();
  let query = (supabase as any)
    .from("participant_profiles")
    .select("id, preferred_name, clients(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (search && search.trim()) {
    const like = `%${search.trim()}%`;
    query = query.or(`preferred_name.ilike.${like},clients.name.ilike.${like}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((p: any) => ({
    id: p.id as string,
    name: (p.preferred_name as string | null) || (p.clients?.name as string) || "Participant",
  }));
}

export async function getCoordinationDailyKPIAction(input: {
  organization_id: string;
  coordinator_id?: string;
  date?: string;
  target_hours?: number;
}) {
  const date = input.date ? new Date(input.date) : new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59).toISOString();

  const rows = await listCoordinationEntriesAction({
    organization_id: input.organization_id,
    coordinator_id: input.coordinator_id,
    date_from: start,
    date_to: end,
    limit: 500,
  });

  const units = rows.reduce((sum: number, r: any) => sum + Number(r.billable_units || 0), 0);
  const billableHours = Number((units * 0.1).toFixed(2));
  const target = input.target_hours ?? 5.0;
  return {
    billable_hours_today: billableHours,
    target_hours: target,
    progress_percent: target > 0 ? Math.min(100, (billableHours / target) * 100) : 0,
    entries_count: rows.length,
  };
}

export async function getCoordinationLedgerSummaryAction(organizationId: string) {
  const { supabase, user } = await requireUser();
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: weekRows }, { data: unbilledRows }, { data: invoicedRows }, { data: draftRows }] = await Promise.all([
    (supabase as any)
      .from("coordination_time_entries")
      .select("billable_units")
      .eq("organization_id", organizationId)
      .eq("coordinator_id", user.id)
      .gte("start_time", weekStart.toISOString()),
    (supabase as any)
      .from("coordination_time_entries")
      .select("billable_charge")
      .eq("organization_id", organizationId)
      .eq("coordinator_id", user.id)
      .eq("status", "unbilled"),
    (supabase as any)
      .from("coordination_time_entries")
      .select("billable_charge")
      .eq("organization_id", organizationId)
      .eq("coordinator_id", user.id)
      .in("status", ["invoiced", "paid"])
      .gte("start_time", monthStart),
    (supabase as any)
      .from("coordination_time_entries")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("coordinator_id", user.id)
      .eq("status", "draft"),
  ]);

  const weeklyUnits = (weekRows || []).reduce((s: number, r: any) => s + Number(r.billable_units || 0), 0);
  const unbilledWip = (unbilledRows || []).reduce((s: number, r: any) => s + Number(r.billable_charge || 0), 0);
  const invoicedMtd = (invoicedRows || []).reduce((s: number, r: any) => s + Number(r.billable_charge || 0), 0);

  return {
    weekly_billable_hours: Number((weeklyUnits * 0.1).toFixed(1)),
    unbilled_wip: Number(unbilledWip.toFixed(2)),
    invoiced_mtd: Number(invoicedMtd.toFixed(2)),
    draft_entries: (draftRows || []).length,
  };
}

export async function getParticipantCoordinationLogsAction(input: {
  organization_id: string;
  participant_id: string;
  limit?: number;
}) {
  const { supabase } = await requireUser();
  const { data, error } = await (supabase as any)
    .from("coordination_time_entries")
    .select("id, start_time, end_time, billable_units, activity_type, case_note, total_charge, status")
    .eq("organization_id", input.organization_id)
    .eq("participant_id", input.participant_id)
    .order("start_time", { ascending: false })
    .limit(input.limit || 30);
  if (error) throw new Error(error.message);
  return data ?? [];
}

