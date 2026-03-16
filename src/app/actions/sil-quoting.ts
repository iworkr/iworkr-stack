"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { SilRocFamilyDocument } from "@/components/pdf/sil-roc-family-document";

const CreateSilQuoteSchema = z.object({
  organization_id: z.string().uuid(),
  facility_id: z.string().uuid(),
  name: z.string().min(2).max(200),
  base_week_start: z.string(),
  participant_ids: z.array(z.string().uuid()).min(1),
  source_mode: z.enum(["master_roster", "blank"]).default("blank"),
  default_ndis_line_item: z.string().optional(),
  margin_worker_hourly_cost: z.number().min(0).max(500).optional(),
});

const UpdateBlockSchema = z.object({
  quote_id: z.string().uuid(),
  block_id: z.string().uuid(),
  active_workers: z.number().int().min(0).optional(),
  is_sleepover: z.boolean().optional(),
  is_active_night: z.boolean().optional(),
  ndis_line_item_code: z.string().optional().nullable(),
});

const PaintAbsenceSchema = z.object({
  quote_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  start_time: z.string(),
  end_time: z.string(),
  is_present: z.boolean().default(false),
});

const ShareOverrideSchema = z.object({
  quote_id: z.string().uuid(),
  participant_id: z.string().uuid(),
  block_id: z.string().uuid(),
  share_override: z.number().min(0).max(5).nullable(),
});

async function requireUser() {
  const supabase = (await createServerSupabaseClient()) as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

async function importMasterRosterWorkers(
  supabase: any,
  quoteId: string,
  orgId: string,
  participantIds: string[],
) {
  const { data: blocks } = await supabase
    .from("sil_quote_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("quote_id", quoteId);
  if (!blocks?.length) return;

  const blockByKey = new Map<string, { id: string; workers: number }>();
  for (const b of blocks) {
    blockByKey.set(`${b.day_of_week}-${String(b.start_time).slice(0, 5)}`, {
      id: b.id,
      workers: 0,
    });
  }

  const { data: templates } = await supabase
    .from("roster_templates")
    .select("id, participant_id")
    .eq("organization_id", orgId)
    .in("participant_id", participantIds)
    .eq("is_active", true);
  const templateIds = (templates || []).map((t: any) => t.id);
  if (templateIds.length === 0) return;

  const { data: shifts } = await supabase
    .from("template_shifts")
    .select("template_id, day_of_cycle, start_time, end_time")
    .eq("organization_id", orgId)
    .in("template_id", templateIds);

  for (const shift of shifts || []) {
    const day = Math.min(7, Math.max(1, Number(shift.day_of_cycle || 1)));
    const start = String(shift.start_time).slice(0, 5);
    const end = String(shift.end_time).slice(0, 5);
    // Stamp half-hour buckets with +1 worker for this template shift.
    let cursor = new Date(`1970-01-01T${start}:00Z`);
    const stop = new Date(`1970-01-01T${end}:00Z`);
    while (cursor < stop) {
      const hh = String(cursor.getUTCHours()).padStart(2, "0");
      const mm = String(cursor.getUTCMinutes()).padStart(2, "0");
      const key = `${day}-${hh}:${mm}`;
      const block = blockByKey.get(key);
      if (block) block.workers += 1;
      cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
    }
  }

  for (const [, value] of blockByKey) {
    if (value.workers > 0) {
      await supabase
        .from("sil_quote_blocks")
        .update({ active_workers: value.workers })
        .eq("id", value.id);
    }
  }
}

export async function createSilQuoteAction(input: z.infer<typeof CreateSilQuoteSchema>) {
  const parsed = CreateSilQuoteSchema.parse(input);
  const { supabase, user } = await requireUser();

  const { data: quote, error } = await supabase
    .from("sil_quotes")
    .insert({
      organization_id: parsed.organization_id,
      facility_id: parsed.facility_id,
      name: parsed.name,
      base_week_start: parsed.base_week_start,
      source_mode: parsed.source_mode,
      default_ndis_line_item: parsed.default_ndis_line_item ?? null,
      margin_worker_hourly_cost: parsed.margin_worker_hourly_cost ?? 42,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const participantRows = parsed.participant_ids.map((participant_id) => ({
    quote_id: quote.id,
    participant_id,
  }));
  await supabase.from("sil_quote_participants").insert(participantRows);
  await supabase.rpc("initialize_sil_quote_blocks", { p_quote_id: quote.id });

  if (parsed.source_mode === "master_roster") {
    await importMasterRosterWorkers(supabase, quote.id, parsed.organization_id, parsed.participant_ids);
  }

  await supabase.rpc("recalculate_sil_quote_blocks", { p_quote_id: quote.id });
  revalidatePath("/dashboard/care/sil-quoting");
  return quote;
}

export async function listSilQuotesAction(organizationId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sil_quotes")
    .select("*, care_facilities(name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getSilQuoteWorkspaceAction(quoteId: string) {
  const { supabase } = await requireUser();
  const [{ data: quote, error: quoteErr }, { data: participants, error: pErr }, { data: blocks, error: bErr }, { data: lineItems, error: liErr }] =
    await Promise.all([
      supabase.from("sil_quotes").select("*, care_facilities(name)").eq("id", quoteId).single(),
      supabase
        .from("sil_quote_participants")
        .select("participant_id, participant_profiles(id, preferred_name, clients(name), ndis_number)")
        .eq("quote_id", quoteId),
      supabase
        .from("sil_quote_blocks")
        .select("id, day_of_week, start_time, end_time, active_workers, active_participants, is_sleepover, is_active_night, ndis_line_item_code")
        .eq("quote_id", quoteId)
        .order("day_of_week")
        .order("start_time"),
      supabase
        .from("sil_quote_line_items")
        .select("*")
        .eq("quote_id", quoteId)
        .order("annual_cost", { ascending: false }),
    ]);
  if (quoteErr) throw new Error(quoteErr.message);
  if (pErr) throw new Error(pErr.message);
  if (bErr) throw new Error(bErr.message);
  if (liErr) throw new Error(liErr.message);

  return {
    quote,
    participants: participants || [],
    blocks: blocks || [],
    line_items: lineItems || [],
  };
}

export async function updateSilQuoteBlockAction(input: z.infer<typeof UpdateBlockSchema>) {
  const parsed = UpdateBlockSchema.parse(input);
  const { supabase } = await requireUser();
  const patch: Record<string, unknown> = {};
  if (parsed.active_workers !== undefined) patch.active_workers = parsed.active_workers;
  if (parsed.is_sleepover !== undefined) patch.is_sleepover = parsed.is_sleepover;
  if (parsed.is_active_night !== undefined) patch.is_active_night = parsed.is_active_night;
  if (parsed.ndis_line_item_code !== undefined) patch.ndis_line_item_code = parsed.ndis_line_item_code;

  const { error } = await supabase
    .from("sil_quote_blocks")
    .update(patch)
    .eq("quote_id", parsed.quote_id)
    .eq("id", parsed.block_id);
  if (error) throw new Error(error.message);
  await supabase.rpc("recalculate_sil_quote_blocks", { p_quote_id: parsed.quote_id });
  revalidatePath("/dashboard/care/sil-quoting");
  return { success: true };
}

export async function paintParticipantAbsenceAction(input: z.infer<typeof PaintAbsenceSchema>) {
  const parsed = PaintAbsenceSchema.parse(input);
  const { supabase } = await requireUser();
  const { data: blocks, error } = await supabase
    .from("sil_quote_blocks")
    .select("id")
    .eq("quote_id", parsed.quote_id)
    .eq("day_of_week", parsed.day_of_week)
    .gte("start_time", parsed.start_time)
    .lt("start_time", parsed.end_time);
  if (error) throw new Error(error.message);
  const blockIds = (blocks || []).map((b: any) => b.id);
  if (blockIds.length === 0) return { updated: 0 };

  const { error: upErr } = await supabase
    .from("sil_quote_block_participants")
    .update({ is_present: parsed.is_present })
    .eq("quote_id", parsed.quote_id)
    .eq("participant_id", parsed.participant_id)
    .in("block_id", blockIds);
  if (upErr) throw new Error(upErr.message);
  await supabase.rpc("recalculate_sil_quote_blocks", { p_quote_id: parsed.quote_id });
  revalidatePath("/dashboard/care/sil-quoting");
  return { updated: blockIds.length };
}

export async function setBlockParticipantShareOverrideAction(input: z.infer<typeof ShareOverrideSchema>) {
  const parsed = ShareOverrideSchema.parse(input);
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sil_quote_block_participants")
    .update({ share_override: parsed.share_override })
    .eq("quote_id", parsed.quote_id)
    .eq("participant_id", parsed.participant_id)
    .eq("block_id", parsed.block_id);
  if (error) throw new Error(error.message);
  await supabase.rpc("recalculate_sil_quote_blocks", { p_quote_id: parsed.quote_id });
  return { success: true };
}

export async function addIrregularSilSupportAction(input: {
  quote_id: string;
  participant_id?: string;
  description: string;
  annual_cost: number;
}) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sil_quote_irregular_supports")
    .insert({
      quote_id: input.quote_id,
      participant_id: input.participant_id ?? null,
      description: input.description,
      annual_cost: input.annual_cost,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Mirror irregular supports into quote line items for totals visibility.
  await supabase.from("sil_quote_line_items").insert({
    quote_id: input.quote_id,
    participant_id: input.participant_id || (await supabase
      .from("sil_quote_participants")
      .select("participant_id")
      .eq("quote_id", input.quote_id)
      .limit(1)
      .single()).data?.participant_id,
    ndis_line_item_code: "IRREGULAR_SUPPORT",
    total_hours_per_week: 0,
    hourly_rate: 0,
    weekly_cost: Number((input.annual_cost / 52.14).toFixed(2)),
    annual_cost: input.annual_cost,
    is_irregular_support: true,
  });
  await supabase.rpc("recalculate_sil_quote_blocks", { p_quote_id: input.quote_id });
  revalidatePath("/dashboard/care/sil-quoting");
  return data;
}

export async function generateSilRocExcelAction(input: { quote_id: string; organization_id: string }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.functions.invoke("generate-sil-roc-excel", {
    body: { quote_id: input.quote_id, organization_id: input.organization_id },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function publishSilFamilyPdfAction(input: {
  quote_id: string;
  organization_id: string;
  participant_id: string;
}) {
  const { supabase, user } = await requireUser();
  const [{ data: quote }, { data: participant }, { data: lines }] = await Promise.all([
    supabase
      .from("sil_quotes")
      .select("id, name, care_facilities(name)")
      .eq("id", input.quote_id)
      .single(),
    supabase
      .from("participant_profiles")
      .select("id, preferred_name, clients(name)")
      .eq("id", input.participant_id)
      .single(),
    supabase
      .from("sil_quote_line_items")
      .select("ndis_line_item_code, total_hours_per_week, weekly_cost, annual_cost")
      .eq("quote_id", input.quote_id)
      .eq("participant_id", input.participant_id),
  ]);

  const annualTotal = (lines || []).reduce((sum: number, line: any) => sum + Number(line.annual_cost || 0), 0);
  const element = createElement(SilRocFamilyDocument, {
    participantName: participant?.preferred_name || participant?.clients?.name || "Participant",
    facilityName: quote?.care_facilities?.name || "Facility",
    quoteName: quote?.name || "SIL Quote",
    lines: lines || [],
    annualTotal,
  });
  const pdfBuffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  const bytes = new Uint8Array(pdfBuffer as ArrayLike<number>);
  const path = `sil-quotes/${input.organization_id}/${input.quote_id}/family-${input.participant_id}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("documents")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);

  await supabase.from("participant_documents").insert({
    organization_id: input.organization_id,
    participant_id: input.participant_id,
    uploaded_by: user.id,
    title: "SIL Roster of Care Summary",
    file_path: path,
    mime_type: "application/pdf",
    status: "pending_signature",
    is_visible_to_family: true,
    requires_signature: true,
  });
  revalidatePath("/portal");
  return { success: true, file_path: path };
}

export async function syncSilQuoteToMasterRosterAction(input: { quote_id: string }) {
  const { supabase } = await requireUser();
  const { data: quote, error: qErr } = await supabase
    .from("sil_quotes")
    .select("id, organization_id, facility_id, name, status")
    .eq("id", input.quote_id)
    .single();
  if (qErr) throw new Error(qErr.message);
  if (quote.status !== "approved") throw new Error("Quote must be approved before syncing.");

  const { data: participants, error: pErr } = await supabase
    .from("sil_quote_participants")
    .select("participant_id")
    .eq("quote_id", input.quote_id);
  if (pErr) throw new Error(pErr.message);

  const { data: blocks, error: bErr } = await supabase
    .from("sil_quote_blocks")
    .select("id, day_of_week, start_time, end_time, active_workers, ndis_line_item_code")
    .eq("quote_id", input.quote_id)
    .gt("active_workers", 0);
  if (bErr) throw new Error(bErr.message);

  for (const p of participants || []) {
    const { data: tpl } = await supabase
      .from("roster_templates")
      .insert({
        organization_id: quote.organization_id,
        participant_id: p.participant_id,
        name: `${quote.name} - Approved RoC`,
        cycle_length_days: 7,
        is_active: true,
        notes: "Generated from SIL quote sync.",
      })
      .select("id")
      .single();
    if (!tpl?.id) continue;

    const shiftRows = (blocks || []).map((b: any) => ({
      template_id: tpl.id,
      organization_id: quote.organization_id,
      day_of_cycle: b.day_of_week,
      start_time: b.start_time,
      end_time: b.end_time,
      ndis_line_item: b.ndis_line_item_code || "01_013_0107_1_1",
      support_purpose: "SIL quoted support block",
      title: "SIL Support",
      notes: `Synced from quote ${quote.id}`,
      public_holiday_behavior: "flag",
    }));
    if (shiftRows.length > 0) {
      await supabase.from("template_shifts").insert(shiftRows);
    }
  }

  revalidatePath("/dashboard/roster/master");
  return { success: true, templates_created: (participants || []).length };
}

export async function setSilQuoteStatusAction(input: { quote_id: string; status: "draft" | "pending_approval" | "approved" | "rejected" | "archived" }) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("sil_quotes")
    .update({ status: input.status })
    .eq("id", input.quote_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/sil-quoting");
  return { success: true };
}

export async function getSilQuoteVarianceAction(input: { organization_id: string; quote_id: string }) {
  const { supabase } = await requireUser();
  const { data: quote, error: qErr } = await supabase
    .from("sil_quotes")
    .select("id, organization_id, total_annual_cost")
    .eq("id", input.quote_id)
    .single();
  if (qErr) throw new Error(qErr.message);

  const { data: pRows } = await supabase
    .from("sil_quote_participants")
    .select("participant_id")
    .eq("quote_id", input.quote_id);
  const participantIds = (pRows || []).map((x: any) => x.participant_id);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: actualRows } = await supabase
    .from("claim_line_items")
    .select("total_amount")
    .eq("organization_id", input.organization_id)
    .in("participant_id", participantIds)
    .gte("service_date", since)
    .in("status", ["approved", "submitted", "paid"]);

  const actual30 = (actualRows || []).reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);
  const quoted30 = Number(quote.total_annual_cost || 0) / 12;
  const variancePct = quoted30 > 0 ? ((actual30 - quoted30) / quoted30) * 100 : 0;

  return {
    quoted_30d_projection: Number(quoted30.toFixed(2)),
    actual_30d: Number(actual30.toFixed(2)),
    variance_percent: Number(variancePct.toFixed(2)),
    anomaly: variancePct > 10
      ? "over_servicing"
      : variancePct < -10
        ? "under_servicing"
        : "stable",
  };
}

