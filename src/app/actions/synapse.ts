/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

/**
 * Project Synapse — PRODA Bulk Claiming Engine
 *
 * Server actions for:
 *  1. Aggregation Engine: Sweep approved timesheets → generate claim_line_items with MMM loading
 *  2. PRODA CSV Generation: Compile claim_line_items into NDIS PRODA/PACE CSV format
 *  3. Return File Ingestion: Parse PRODA return CSV → reconcile claim statuses
 *  4. Dashboard queries: Aggregation runs, return entries, batch lifecycle
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────────────────────── */

export interface AggregationResult {
  run_id: string;
  timesheets_swept: number;
  time_entries_processed: number;
  claim_lines_created: number;
  total_claim_amount: number;
  errors: Array<{ entry_id: string; error: string }>;
  status: "completed" | "partial" | "failed";
}

export interface ClaimLineItem {
  id: string;
  organization_id: string;
  shift_id: string | null;
  participant_id: string;
  funder_id: string | null;
  ndis_item_number: string | null;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  region_modifier: number;
  gst_amount: number;
  status: string;
  service_date: string | null;
  worker_id: string | null;
  time_entry_id: string | null;
  mmm_classification: number;
  claim_batch_id: string | null;
  rejection_code: string | null;
  rejection_reason: string | null;
  aggregated_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  created_at: string;
  // Joined fields
  participant_profiles?: { id: string; ndis_number?: string; preferred_name?: string } | null;
  worker_profile?: { full_name?: string } | null;
}

export interface AggregationRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  timesheets_swept: number;
  time_entries_processed: number;
  claim_lines_created: number;
  total_claim_amount: number;
  status: string;
  error_log: any[];
  triggered_by: string | null;
  batch_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReturnEntry {
  id: string;
  organization_id: string;
  batch_id: string | null;
  claim_reference: string;
  ndis_number: string | null;
  support_item_number: string | null;
  service_date: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  outcome: string;
  paid_amount: number | null;
  rejection_code: string | null;
  rejection_reason: string | null;
  adjustment_amount: number | null;
  claim_line_item_id: string | null;
  proda_transaction_id: string | null;
  created_at: string;
}

export interface ProdaBatch {
  id: string;
  organization_id: string;
  batch_number: string | null;
  status: string;
  total_claims: number;
  successful_claims: number;
  failed_claims: number;
  total_amount: number;
  paid_amount: number;
  rejected_amount: number;
  adjusted_amount: number;
  submitted_at: string | null;
  reconciled_at: string | null;
  submitted_by: string | null;
  proda_reference: string | null;
  payload_url: string | null;
  return_file_url: string | null;
  return_file_uploaded_at: string | null;
  aggregation_period_start: string | null;
  aggregation_period_end: string | null;
  error_log: any;
  created_at: string;
}

/* ── 1. Aggregation Engine ────────────────────────────────────────────── */

/**
 * Sweeps all approved timesheets within a date range, looks up each time entry's
 * linked schedule_block → NDIS line item → participant MMM classification →
 * calculates the geographic-loaded rate → creates claim_line_items in 'draft' status.
 */
export async function aggregateApprovedTimesheets(
  organizationId: string,
  periodStart: string, // ISO date YYYY-MM-DD
  periodEnd: string,
): Promise<AggregationResult> {
  const admin = createAdminSupabaseClient() as any;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Create aggregation run record
  const { data: run, error: runErr } = await admin
    .from("proda_aggregation_runs")
    .insert({
      organization_id: organizationId,
      period_start: periodStart,
      period_end: periodEnd,
      triggered_by: user.id,
      status: "running",
    })
    .select()
    .single();

  if (runErr) throw new Error(`Failed to create aggregation run: ${runErr.message}`);

  const errors: Array<{ entry_id: string; error: string }> = [];
  let timesheetCount = 0;
  let entryCount = 0;
  let claimCount = 0;
  let totalAmount = 0;

  try {
    // 1. Fetch approved timesheets in the period
    const { data: timesheets } = await admin
      .from("timesheets")
      .select("id, worker_id, period_start, period_end")
      .eq("organization_id", organizationId)
      .eq("status", "approved")
      .gte("period_start", periodStart)
      .lte("period_end", periodEnd);

    timesheetCount = timesheets?.length || 0;

    if (!timesheets?.length) {
      await admin.from("proda_aggregation_runs").update({
        status: "completed",
        timesheets_swept: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return {
        run_id: run.id,
        timesheets_swept: 0,
        time_entries_processed: 0,
        claim_lines_created: 0,
        total_claim_amount: 0,
        errors: [],
        status: "completed",
      };
    }

    const timesheetIds = timesheets.map((t: any) => t.id);

    // 2. Fetch completed time entries linked to these timesheets
    const { data: entries } = await admin
      .from("time_entries")
      .select("id, timesheet_id, shift_id, worker_id, clock_in, clock_out, total_hours, status, scheduled_start")
      .eq("organization_id", organizationId)
      .in("timesheet_id", timesheetIds)
      .in("status", ["completed", "approved"]);

    if (!entries?.length) {
      await admin.from("proda_aggregation_runs").update({
        status: "completed",
        timesheets_swept: timesheetCount,
        completed_at: new Date().toISOString(),
      }).eq("id", run.id);

      return {
        run_id: run.id,
        timesheets_swept: timesheetCount,
        time_entries_processed: 0,
        claim_lines_created: 0,
        total_claim_amount: 0,
        errors: [],
        status: "completed",
      };
    }

    // 3. Check which time entries already have claim lines (prevent duplicates)
    const entryIds = entries.map((e: any) => e.id);
    const { data: existingClaims } = await admin
      .from("claim_line_items")
      .select("time_entry_id")
      .in("time_entry_id", entryIds);

    const alreadyClaimed = new Set((existingClaims || []).map((c: any) => c.time_entry_id));

    // 4. Fetch schedule blocks for NDIS line item mappings
    const shiftIds = [...new Set(entries.map((e: any) => e.shift_id).filter(Boolean))];
    const { data: blocks } = shiftIds.length > 0
      ? await admin.from("schedule_blocks").select("id, metadata, job_id").in("id", shiftIds)
      : { data: [] };

    const blockMap = new Map<string, any>();
    (blocks || []).forEach((b: any) => blockMap.set(b.id, b));

    // Also check shift_financial_ledgers for pre-calculated NDIS line items
    const { data: ledgers } = shiftIds.length > 0
      ? await admin.from("shift_financial_ledgers").select("schedule_block_id, ndis_line_item, participant_id, revenue_breakdown").in("schedule_block_id", shiftIds)
      : { data: [] };

    const ledgerMap = new Map<string, any>();
    (ledgers || []).forEach((l: any) => ledgerMap.set(l.schedule_block_id, l));

    // 5. Fetch participant profiles for NDIS numbers + MMM classification
    const participantIds = new Set<string>();
    entries.forEach((e: any) => {
      const block = blockMap.get(e.shift_id);
      const ledger = ledgerMap.get(e.shift_id);
      const pid = ledger?.participant_id || block?.metadata?.participant_id;
      if (pid) participantIds.add(pid);
    });

    const { data: participants } = participantIds.size > 0
      ? await admin.from("participant_profiles").select("id, ndis_number, mmm_classification, client_id").in("id", [...participantIds])
      : { data: [] };

    const participantMap = new Map<string, any>();
    (participants || []).forEach((p: any) => participantMap.set(p.id, p));

    // Fetch client names
    const clientIds = [...new Set((participants || []).map((p: any) => p.client_id).filter(Boolean))];
    const { data: clients } = clientIds.length > 0
      ? await admin.from("clients").select("id, name").in("id", clientIds)
      : { data: [] };
    const clientNameMap = new Map<string, string>();
    (clients || []).forEach((c: any) => clientNameMap.set(c.id, c.name));

    // 6. Fetch NDIS rates for each unique line item + MMM combo
    // We'll do this per-entry since rates may vary by date & MMM

    // 7. Process each time entry → claim_line_item
    const claimInserts: any[] = [];

    for (const entry of entries as any[]) {
      entryCount++;

      // Skip if already claimed
      if (alreadyClaimed.has(entry.id)) {
        continue;
      }

      const block = blockMap.get(entry.shift_id);
      const ledger = ledgerMap.get(entry.shift_id);

      // Determine NDIS line item
      const ndisLineItem = ledger?.ndis_line_item
        || block?.metadata?.ndis_line_item
        || block?.metadata?.ndis_item;

      if (!ndisLineItem) {
        errors.push({ entry_id: entry.id, error: "No NDIS line item linked to shift" });
        continue;
      }

      // Determine participant
      const participantId = ledger?.participant_id || block?.metadata?.participant_id;
      if (!participantId) {
        errors.push({ entry_id: entry.id, error: "No participant linked to shift" });
        continue;
      }

      const participant = participantMap.get(participantId);
      if (!participant?.ndis_number) {
        errors.push({ entry_id: entry.id, error: `Participant ${participantId} missing NDIS number` });
        continue;
      }

      // Calculate hours
      const hours = entry.total_hours
        ? parseFloat(entry.total_hours)
        : entry.clock_out
          ? (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 3600000
          : 0;

      if (hours <= 0) {
        errors.push({ entry_id: entry.id, error: "Zero or negative hours" });
        continue;
      }

      // Get the MMM classification and service date
      const mmmClass = participant.mmm_classification || 1;
      const serviceDate = entry.scheduled_start
        ? new Date(entry.scheduled_start).toISOString().split("T")[0]
        : new Date(entry.clock_in).toISOString().split("T")[0];

      // Look up NDIS rate with geographic loading
      const { data: rateResult } = await admin.rpc("get_ndis_rate_with_loading", {
        p_support_item_number: ndisLineItem,
        p_service_date: serviceDate,
        p_mmm_classification: mmmClass,
      });

      const rateRow = Array.isArray(rateResult) ? rateResult[0] : rateResult;
      if (!rateRow) {
        errors.push({ entry_id: entry.id, error: `NDIS rate not found for ${ndisLineItem}` });
        continue;
      }

      const effectiveRate = parseFloat(rateRow.effective_rate) || 0;
      const baseRate = parseFloat(rateRow.base_rate) || 0;
      const modifierPct = parseFloat(rateRow.modifier_pct) || 0;
      const totalAmountLine = Math.round(effectiveRate * hours * 100) / 100;

      claimInserts.push({
        organization_id: organizationId,
        shift_id: entry.shift_id || null,
        participant_id: participantId,
        ndis_item_number: ndisLineItem,
        description: rateRow.item_name || ndisLineItem,
        quantity: Math.round(hours * 100) / 100,
        unit_rate: effectiveRate,
        total_amount: totalAmountLine,
        region_modifier: modifierPct,
        gst_amount: 0, // NDIS services are GST-free
        status: "draft",
        service_date: serviceDate,
        worker_id: entry.worker_id,
        time_entry_id: entry.id,
        mmm_classification: mmmClass,
        aggregated_at: new Date().toISOString(),
      });

      totalAmount += totalAmountLine;
    }

    // 8. Bulk insert claim line items
    if (claimInserts.length > 0) {
      // Insert in batches of 50 to avoid payload limits
      for (let i = 0; i < claimInserts.length; i += 50) {
        const batch = claimInserts.slice(i, i + 50);
        const { error: insertErr } = await admin
          .from("claim_line_items")
          .insert(batch);

        if (insertErr) {
          errors.push({ entry_id: "bulk_insert", error: insertErr.message });
        } else {
          claimCount += batch.length;
        }
      }
    }

    // 9. Update aggregation run
    const finalStatus = errors.length > 0
      ? (claimCount > 0 ? "partial" : "failed")
      : "completed";

    await admin.from("proda_aggregation_runs").update({
      status: finalStatus,
      timesheets_swept: timesheetCount,
      time_entries_processed: entryCount,
      claim_lines_created: claimCount,
      total_claim_amount: totalAmount,
      error_log: errors,
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);

    revalidatePath("/dashboard/care/proda-claims");

    return {
      run_id: run.id,
      timesheets_swept: timesheetCount,
      time_entries_processed: entryCount,
      claim_lines_created: claimCount,
      total_claim_amount: totalAmount,
      errors,
      status: finalStatus,
    };
  } catch (err: any) {
    await admin.from("proda_aggregation_runs").update({
      status: "failed",
      error_log: [{ entry_id: "fatal", error: err.message }],
      completed_at: new Date().toISOString(),
    }).eq("id", run.id);
    throw err;
  }
}

/* ── 2. Approve Draft Claim Lines ─────────────────────────────────────── */

export async function approveClaimLines(
  organizationId: string,
  claimLineIds: string[],
): Promise<{ approved: number }> {
  const admin = createAdminSupabaseClient() as any;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await admin
    .from("claim_line_items")
    .update({ status: "approved" })
    .eq("organization_id", organizationId)
    .eq("status", "draft")
    .in("id", claimLineIds)
    .select("id");

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/care/proda-claims");
  return { approved: data?.length || 0 };
}

/* ── 3. Generate PRODA CSV (Client-side Download) ─────────────────────── */

/**
 * Generates the PRODA/PACE CSV content from approved claim_line_items.
 * Returns the raw CSV string for client-side download + creates a batch record.
 */
export async function generateProdaCSV(
  organizationId: string,
  claimLineIds: string[],
): Promise<{ csv: string; batch_id: string; batch_number: string }> {
  const admin = createAdminSupabaseClient() as any;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch approved claim lines
  const { data: lines, error: lErr } = await admin
    .from("claim_line_items")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", claimLineIds)
    .eq("status", "approved");

  if (lErr || !lines?.length) throw new Error("No approved claim lines found");

  // Fetch participant info
  const pids = [...new Set(lines.map((l: any) => l.participant_id))];
  const { data: participants } = await admin
    .from("participant_profiles")
    .select("id, ndis_number, client_id")
    .in("id", pids);

  const participantMap = new Map<string, any>();
  (participants || []).forEach((p: any) => participantMap.set(p.id, p));

  // Client names
  const clientIds = (participants || []).map((p: any) => p.client_id).filter(Boolean);
  const { data: clients } = clientIds.length > 0
    ? await admin.from("clients").select("id, name").in("id", clientIds)
    : { data: [] };
  const clientNameMap = new Map<string, string>();
  (clients || []).forEach((c: any) => clientNameMap.set(c.id, c.name));

  // Org registration number
  const { data: org } = await admin
    .from("organizations")
    .select("name, metadata")
    .eq("id", organizationId)
    .single();
  const regNum = org?.metadata?.ndis_registration_number || "PENDING";

  // Validate
  const validationErrors: string[] = [];
  for (const line of lines) {
    if (!line.ndis_item_number) validationErrors.push(`Line ${line.id}: missing NDIS item number`);
    const p = participantMap.get(line.participant_id);
    if (!p?.ndis_number) validationErrors.push(`Line ${line.id}: participant missing NDIS number`);
  }
  if (validationErrors.length > 0) {
    throw new Error(`Validation failed:\n${validationErrors.join("\n")}`);
  }

  // Generate CSV
  const header = "RegistrationNumber,NDISNumber,SupportItemNumber,DateOfSupport,Quantity,UnitPrice,TotalPrice,GST,ClaimReference,ParticipantName";
  const rows = lines.map((line: any) => {
    const p = participantMap.get(line.participant_id);
    const name = clientNameMap.get(p?.client_id || "") || "Unknown";
    return [
      regNum,
      p?.ndis_number || "",
      line.ndis_item_number || "",
      line.service_date || "",
      parseFloat(line.quantity).toFixed(2),
      parseFloat(line.unit_rate).toFixed(2),
      parseFloat(line.total_amount).toFixed(2),
      parseFloat(line.gst_amount || 0).toFixed(2),
      line.id.substring(0, 8).toUpperCase(),
      `"${name.replace(/"/g, '""')}"`,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  // Generate batch number
  const { data: batchNum } = await admin.rpc("generate_batch_number", {
    p_organization_id: organizationId,
  });
  const batchNumber = batchNum || `BATCH-${new Date().toISOString().slice(0, 7)}-001`;

  // Calculate totals
  const totalAmount = lines.reduce((sum: number, l: any) => sum + parseFloat(l.total_amount), 0);

  // Find aggregation period from service dates
  const serviceDates = lines.map((l: any) => l.service_date).filter(Boolean).sort();
  const periodStart = serviceDates[0] || null;
  const periodEnd = serviceDates[serviceDates.length - 1] || null;

  // Create batch
  const { data: batch, error: batchErr } = await admin
    .from("proda_claim_batches")
    .insert({
      organization_id: organizationId,
      batch_number: batchNumber,
      status: "draft",
      total_claims: lines.length,
      total_amount: totalAmount,
      submitted_by: user.id,
      aggregation_period_start: periodStart,
      aggregation_period_end: periodEnd,
    })
    .select()
    .single();

  if (batchErr) throw new Error(`Failed to create batch: ${batchErr.message}`);

  // Link claim lines to batch
  await admin
    .from("claim_line_items")
    .update({ claim_batch_id: batch.id, status: "submitted" })
    .in("id", claimLineIds);

  // Upload CSV to storage
  const fileName = `proda/${organizationId}/${batchNumber}.csv`;
  await admin.storage
    .from("documents")
    .upload(fileName, new Blob([csv], { type: "text/csv" }), {
      contentType: "text/csv",
      upsert: true,
    });

  // Update batch with payload URL and submitted status
  await admin.from("proda_claim_batches").update({
    status: "submitted",
    submitted_at: new Date().toISOString(),
    payload_url: fileName,
  }).eq("id", batch.id);

  revalidatePath("/dashboard/care/proda-claims");

  return { csv, batch_id: batch.id, batch_number: batchNumber };
}

/* ── 4. Return File Ingestion ─────────────────────────────────────────── */

/**
 * Parses the PRODA return CSV and reconciles claim line items.
 * Expected CSV columns: ClaimReference,NDISNumber,SupportItemNumber,DateOfSupport,
 *   Quantity,UnitPrice,TotalPrice,GST,Outcome,PaidAmount,RejectionCode,RejectionReason,TransactionID
 */
export async function ingestReturnFile(
  organizationId: string,
  batchId: string,
  csvContent: string,
): Promise<{
  total_rows: number;
  paid: number;
  rejected: number;
  adjusted: number;
  unmatched: number;
  paid_total: number;
  rejected_total: number;
}> {
  const admin = createAdminSupabaseClient() as any;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Parse CSV
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) throw new Error("Return file appears empty or has no data rows");

  const headerLine = lines[0];
  const headers = parseCSVRow(headerLine).map((h) => h.trim().toLowerCase());

  // Map header indices
  const colIndex = (name: string) => {
    const idx = headers.findIndex((h) =>
      h === name || h.replace(/[^a-z]/g, "") === name.replace(/[^a-z]/g, "")
    );
    return idx;
  };

  const claimRefIdx = colIndex("claimreference");
  const ndisNumIdx = colIndex("ndisnumber");
  const itemNumIdx = colIndex("supportitemnumber");
  const serviceDateIdx = colIndex("dateofsupport");
  const qtyIdx = colIndex("quantity");
  const unitPriceIdx = colIndex("unitprice");
  const totalPriceIdx = colIndex("totalprice");
  const outcomeIdx = colIndex("outcome");
  const paidAmtIdx = colIndex("paidamount");
  const rejCodeIdx = colIndex("rejectioncode");
  const rejReasonIdx = colIndex("rejectionreason");
  const txnIdIdx = colIndex("transactionid");

  if (outcomeIdx < 0) {
    throw new Error("Return file missing required 'Outcome' column");
  }

  let paid = 0;
  let rejected = 0;
  let adjusted = 0;
  let unmatched = 0;
  let paidTotal = 0;
  let rejectedTotal = 0;

  const returnInserts: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const cols = parseCSVRow(rawLine);

    const claimRef = claimRefIdx >= 0 ? cols[claimRefIdx]?.trim() : "";
    const outcome = outcomeIdx >= 0 ? cols[outcomeIdx]?.trim().toLowerCase() : "pending";
    const paidAmt = paidAmtIdx >= 0 ? parseFloat(cols[paidAmtIdx]) || 0 : 0;
    const totalPrice = totalPriceIdx >= 0 ? parseFloat(cols[totalPriceIdx]) || 0 : 0;
    const rejCode = rejCodeIdx >= 0 ? cols[rejCodeIdx]?.trim() : null;
    const rejReason = rejReasonIdx >= 0 ? cols[rejReasonIdx]?.trim() : null;
    const txnId = txnIdIdx >= 0 ? cols[txnIdIdx]?.trim() : null;

    // Normalize outcome
    let normalizedOutcome: "paid" | "rejected" | "adjusted" | "pending" = "pending";
    if (outcome === "paid" || outcome === "success" || outcome === "approved") {
      normalizedOutcome = "paid";
      paid++;
      paidTotal += paidAmt || totalPrice;
    } else if (outcome === "rejected" || outcome === "failed" || outcome === "error") {
      normalizedOutcome = "rejected";
      rejected++;
      rejectedTotal += totalPrice;
    } else if (outcome === "adjusted" || outcome === "partial") {
      normalizedOutcome = "adjusted";
      adjusted++;
      paidTotal += paidAmt;
    }

    // Try to match claim_line_item by claim reference
    // Our claim references are first 8 chars of the UUID, uppercased
    let matchedLineId: string | null = null;
    if (claimRef) {
      const { data: matchedLines } = await admin
        .from("claim_line_items")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("claim_batch_id", batchId)
        .ilike("id", `${claimRef.toLowerCase()}%`)
        .limit(1);

      if (matchedLines?.length) {
        matchedLineId = matchedLines[0].id;
      } else {
        unmatched++;
      }
    }

    returnInserts.push({
      organization_id: organizationId,
      batch_id: batchId,
      claim_reference: claimRef,
      ndis_number: ndisNumIdx >= 0 ? cols[ndisNumIdx]?.trim() : null,
      support_item_number: itemNumIdx >= 0 ? cols[itemNumIdx]?.trim() : null,
      service_date: serviceDateIdx >= 0 ? cols[serviceDateIdx]?.trim() : null,
      quantity: qtyIdx >= 0 ? parseFloat(cols[qtyIdx]) || null : null,
      unit_price: unitPriceIdx >= 0 ? parseFloat(cols[unitPriceIdx]) || null : null,
      total_price: totalPrice || null,
      outcome: normalizedOutcome,
      paid_amount: paidAmt || null,
      rejection_code: rejCode || null,
      rejection_reason: rejReason || null,
      claim_line_item_id: matchedLineId,
      proda_transaction_id: txnId || null,
      raw_row: Object.fromEntries(headers.map((h, idx) => [h, cols[idx] || ""])),
    });

    // Update the claim_line_item status
    if (matchedLineId) {
      const updates: any = {};
      if (normalizedOutcome === "paid") {
        updates.status = "paid";
        updates.paid_at = new Date().toISOString();
        updates.paid_amount = paidAmt || totalPrice;
      } else if (normalizedOutcome === "rejected") {
        updates.status = "rejected";
        updates.rejection_code = rejCode;
        updates.rejection_reason = rejReason;
      } else if (normalizedOutcome === "adjusted") {
        updates.status = "paid";
        updates.paid_at = new Date().toISOString();
        updates.paid_amount = paidAmt;
      }

      if (Object.keys(updates).length > 0) {
        await admin.from("claim_line_items").update(updates).eq("id", matchedLineId);
      }
    }
  }

  // Bulk insert return entries
  if (returnInserts.length > 0) {
    for (let i = 0; i < returnInserts.length; i += 50) {
      await admin.from("proda_return_entries").insert(returnInserts.slice(i, i + 50));
    }
  }

  // Update batch with reconciliation data
  const totalRows = returnInserts.length;
  const batchStatus = rejected > 0 ? "partially_reconciled" : "reconciled";

  await admin.from("proda_claim_batches").update({
    status: batchStatus,
    successful_claims: paid + adjusted,
    failed_claims: rejected,
    paid_amount: paidTotal,
    rejected_amount: rejectedTotal,
    reconciled_at: new Date().toISOString(),
    return_file_uploaded_at: new Date().toISOString(),
  }).eq("id", batchId);

  // Upload return file to storage for audit
  const fileName = `proda/${organizationId}/returns/${batchId}.csv`;
  await admin.storage
    .from("documents")
    .upload(fileName, new Blob([csvContent], { type: "text/csv" }), {
      contentType: "text/csv",
      upsert: true,
    });

  await admin.from("proda_claim_batches").update({
    return_file_url: fileName,
  }).eq("id", batchId);

  revalidatePath("/dashboard/care/proda-claims");

  return {
    total_rows: totalRows,
    paid,
    rejected,
    adjusted,
    unmatched,
    paid_total: Math.round(paidTotal * 100) / 100,
    rejected_total: Math.round(rejectedTotal * 100) / 100,
  };
}

/* ── 5. Mark Batch as Submitted to PRODA ──────────────────────────────── */

export async function markBatchSubmitted(
  batchId: string,
  prodaReference?: string,
): Promise<void> {
  const admin = createAdminSupabaseClient() as any;
  await admin.from("proda_claim_batches").update({
    status: "processing",
    proda_reference: prodaReference || null,
    submitted_at: new Date().toISOString(),
  }).eq("id", batchId);
  revalidatePath("/dashboard/care/proda-claims");
}

/* ── 6. Fetch Dashboard Data ──────────────────────────────────────────── */

export async function fetchSynapseBatches(organizationId: string): Promise<ProdaBatch[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("proda_claim_batches")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSynapseClaimLines(
  organizationId: string,
  filters?: { status?: string; batch_id?: string },
): Promise<ClaimLineItem[]> {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("claim_line_items")
    .select("*, participant_profiles!claim_line_items_participant_id_fkey(id, ndis_number, preferred_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.batch_id) query = query.eq("claim_batch_id", filters.batch_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSynapseAggregationRuns(organizationId: string): Promise<AggregationRun[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("proda_aggregation_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchSynapseReturnEntries(
  organizationId: string,
  batchId?: string,
): Promise<ReturnEntry[]> {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("proda_return_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (batchId) query = query.eq("batch_id", batchId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

/* ── 7. Dashboard Statistics ──────────────────────────────────────────── */

export async function fetchSynapseStats(organizationId: string): Promise<{
  draft_lines: number;
  draft_amount: number;
  approved_lines: number;
  approved_amount: number;
  submitted_lines: number;
  submitted_amount: number;
  paid_lines: number;
  paid_amount: number;
  rejected_lines: number;
  rejected_amount: number;
  total_lines: number;
  total_amount: number;
}> {
  const admin = createAdminSupabaseClient() as any;

  const { data } = await admin
    .from("claim_line_items")
    .select("status, total_amount")
    .eq("organization_id", organizationId);

  const stats = {
    draft_lines: 0, draft_amount: 0,
    approved_lines: 0, approved_amount: 0,
    submitted_lines: 0, submitted_amount: 0,
    paid_lines: 0, paid_amount: 0,
    rejected_lines: 0, rejected_amount: 0,
    total_lines: 0, total_amount: 0,
  };

  for (const row of (data || []) as any[]) {
    const amt = parseFloat(row.total_amount) || 0;
    stats.total_lines++;
    stats.total_amount += amt;

    switch (row.status) {
      case "draft":
        stats.draft_lines++;
        stats.draft_amount += amt;
        break;
      case "approved":
        stats.approved_lines++;
        stats.approved_amount += amt;
        break;
      case "submitted":
        stats.submitted_lines++;
        stats.submitted_amount += amt;
        break;
      case "paid":
        stats.paid_lines++;
        stats.paid_amount += amt;
        break;
      case "rejected":
        stats.rejected_lines++;
        stats.rejected_amount += amt;
        break;
    }
  }

  // Round all amounts
  Object.keys(stats).forEach((k) => {
    if (k.endsWith("_amount")) {
      (stats as any)[k] = Math.round((stats as any)[k] * 100) / 100;
    }
  });

  return stats;
}

/* ── CSV Parsing Helper ───────────────────────────────────────────────── */

function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}
