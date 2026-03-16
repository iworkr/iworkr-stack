import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CoordinationEntry = {
  id: string;
  organization_id: string;
  participant_id: string;
  coordinator_id: string;
  start_time: string;
  end_time: string;
  billable_units: number;
  ndis_line_item: string;
  hourly_rate: number;
  total_charge: number;
  billable_charge: number;
  activity_type: string;
  case_note: string;
  status: "unbilled" | "aggregated" | "claimed" | "paid" | "written_off";
};

function getPreviousWeekWindow(now = new Date()) {
  const utcDay = now.getUTCDay(); // 0 Sunday
  const thisWeekSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - utcDay));
  const prevWeekSunday = new Date(thisWeekSunday);
  prevWeekSunday.setUTCDate(thisWeekSunday.getUTCDate() - 7);
  const prevWeekMonday = new Date(prevWeekSunday);
  prevWeekMonday.setUTCDate(prevWeekSunday.getUTCDate() - 6);
  const start = new Date(Date.UTC(prevWeekMonday.getUTCFullYear(), prevWeekMonday.getUTCMonth(), prevWeekMonday.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(prevWeekSunday.getUTCFullYear(), prevWeekSunday.getUTCMonth(), prevWeekSunday.getUTCDate(), 23, 59, 59));
  return { start, end };
}

async function nextDisplayId(admin: ReturnType<typeof createClient>, organizationId: string) {
  const { data } = await admin
    .from("invoices")
    .select("display_id")
    .eq("organization_id", organizationId)
    .like("display_id", "INV-%")
    .order("display_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.display_id) return "INV-0001";
  const m = String(data.display_id).match(/INV-(\d+)/);
  if (!m) return "INV-0001";
  return `INV-${String(Number(m[1]) + 1).padStart(4, "0")}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const orgId = body.organization_id as string | undefined;
    const windowStart = body.window_start as string | undefined;
    const windowEnd = body.window_end as string | undefined;

    const window = windowStart && windowEnd
      ? { start: new Date(windowStart), end: new Date(windowEnd) }
      : getPreviousWeekWindow(new Date());

    let query = admin
      .from("coordination_time_entries")
      .select("*")
      .eq("status", "unbilled")
      .gte("start_time", window.start.toISOString())
      .lte("start_time", window.end.toISOString())
      .order("start_time", { ascending: true });

    if (orgId) query = query.eq("organization_id", orgId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const entries = (rows || []) as CoordinationEntry[];
    if (entries.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        processed_groups: 0,
        entries_aggregated: 0,
        window_start: window.start.toISOString(),
        window_end: window.end.toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const groupMap = new Map<string, CoordinationEntry[]>();
    for (const entry of entries) {
      const key = `${entry.organization_id}|${entry.participant_id}|${entry.ndis_line_item}`;
      const group = groupMap.get(key) || [];
      group.push(entry);
      groupMap.set(key, group);
    }

    let processed = 0;
    let aggregated = 0;

    for (const [key, group] of groupMap.entries()) {
      const [organizationId, participantId, ndisLineItem] = key.split("|");
      const billableUnits = group.reduce((sum, g) => sum + Number(g.billable_units || 0), 0);
      const quantityHours = Number((billableUnits * 0.1).toFixed(2));
      const totalCharge = Number(group.reduce((sum, g) => sum + Number(g.billable_charge || 0), 0).toFixed(2));
      const hourlyRate = Number(group[0]?.hourly_rate || 0);

      const { data: participant } = await admin
        .from("participant_profiles")
        .select("id, client_id, management_type")
        .eq("id", participantId)
        .maybeSingle();
      if (!participant?.client_id) continue;

      const { data: client } = await admin
        .from("clients")
        .select("name, email, address")
        .eq("id", participant.client_id)
        .maybeSingle();

      const notes = group
        .map((e) => {
          const stamp = new Date(e.start_time).toISOString().slice(0, 16).replace("T", " ");
          return `[${stamp}] (${e.activity_type}) ${e.case_note}`;
        })
        .join("\n");

      const displayId = await nextDisplayId(admin, organizationId);
      const issueDate = new Date().toISOString().slice(0, 10);
      const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: invoice, error: invoiceError } = await admin
        .from("invoices")
        .insert({
          organization_id: organizationId,
          display_id: displayId,
          client_id: participant.client_id,
          client_name: client?.name || "Participant",
          client_email: client?.email || null,
          client_address: client?.address || null,
          status: "draft",
          issue_date: issueDate,
          due_date: dueDate,
          subtotal: totalCharge,
          tax_rate: 0,
          tax: 0,
          total: totalCharge,
          notes: notes,
          metadata: {
            source: "chronos_weekly_aggregator",
            weekly_window_start: window.start.toISOString(),
            weekly_window_end: window.end.toISOString(),
            participant_id: participantId,
            ndis_line_item: ndisLineItem,
            entry_ids: group.map((g) => g.id),
          },
        })
        .select("id")
        .single();
      if (invoiceError) throw new Error(invoiceError.message);

      await admin
        .from("invoice_line_items")
        .insert({
          invoice_id: invoice.id,
          description: `Support Coordination Weekly Aggregate (${ndisLineItem})`,
          quantity: quantityHours,
          unit_price: hourlyRate,
          sort_order: 0,
        });

      let claimLineItemId: string | null = null;
      if ((participant.management_type || "").toLowerCase().includes("ndia")) {
        const { data: claim } = await admin
          .from("claim_line_items")
          .insert({
            organization_id: organizationId,
            participant_id: participantId,
            ndis_item_number: ndisLineItem,
            description: `Chronos weekly aggregate ${window.start.toISOString().slice(0, 10)} to ${window.end.toISOString().slice(0, 10)}`,
            quantity: quantityHours,
            unit_rate: hourlyRate,
            total_amount: totalCharge,
            status: "approved",
            service_date: issueDate,
            worker_id: group[0]?.coordinator_id || null,
          })
          .select("id")
          .single();
        claimLineItemId = claim?.id || null;
      }

      await admin
        .from("coordination_time_entries")
        .update({
          status: "aggregated",
          linked_invoice_id: invoice.id,
          linked_claim_line_item_id: claimLineItemId,
          metadata: {
            aggregated_at: new Date().toISOString(),
            aggregated_window_start: window.start.toISOString(),
            aggregated_window_end: window.end.toISOString(),
          },
        })
        .in("id", group.map((g) => g.id));

      processed += 1;
      aggregated += group.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      processed_groups: processed,
      entries_aggregated: aggregated,
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

