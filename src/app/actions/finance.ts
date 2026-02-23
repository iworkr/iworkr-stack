/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Events, dispatch } from "@/lib/automation";
import { createInvoiceSchema, validate } from "@/lib/validation";
import { logger } from "@/lib/logger";

export interface Invoice {
  id: string;
  organization_id: string;
  display_id: string;
  client_id: string | null;
  job_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_address: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "voided";
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  payment_link: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  line_items_count?: number;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  created_at: string;
}

export interface InvoiceEvent {
  id: string;
  invoice_id: string;
  type: "created" | "sent" | "viewed" | "paid" | "voided" | "reminder";
  text: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface Payout {
  id: string;
  organization_id: string;
  amount: number;
  payout_date: string | null;
  bank: string | null;
  invoice_ids: string[];
  status: "completed" | "pending" | "processing";
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CreateInvoiceParams {
  organization_id: string;
  client_id?: string | null;
  job_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  status?: "draft" | "sent" | "paid" | "overdue" | "voided";
  issue_date?: string | null;
  due_date?: string | null;
  tax_rate?: number;
  payment_link?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface UpdateInvoiceParams {
  client_id?: string | null;
  job_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  status?: "draft" | "sent" | "paid" | "overdue" | "voided";
  issue_date?: string | null;
  due_date?: string | null;
  tax_rate?: number;
  payment_link?: string | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
}

export interface AddLineItemParams {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface RevenueStat {
  date: string;
  revenue: number;
}

export interface FinanceOverview {
  revenue_mtd: number;
  revenue_growth: number;
  overdue_amount: number;
  overdue_count: number;
  avg_payout_days: number;
  stripe_balance: number;
  total_paid_all_time: number;
  invoices_sent: number;
  invoices_paid: number;
}

/**
 * Get organization settings (name, tax_id, address, email)
 */
export async function getOrgSettings(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    const { data, error } = await supabase
      .from("organizations")
      .select("name, settings")
      .eq("id", orgId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: { name: data.name, settings: data.settings || {} }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch org settings" };
  }
}

/**
 * Get all invoices for an organization with line items count
 */
export async function getInvoices(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_line_items (
          id
        )
      `)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    const formattedInvoices = invoices.map((invoice: any) => ({
      ...invoice,
      line_items_count: invoice.invoice_line_items?.length || 0,
      invoice_line_items: undefined,
    }));

    return { data: formattedInvoices, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch invoices" };
  }
}

/**
 * Get a single invoice with full details including line items and events
 */
export async function getInvoice(invoiceId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_line_items (
          *
        ),
        invoice_events (
          *
        )
      `)
      .eq("id", invoiceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }

    const formattedInvoice = {
      ...invoice,
      invoice_line_items: (invoice.invoice_line_items || []).sort(
        (a: InvoiceLineItem, b: InvoiceLineItem) => a.sort_order - b.sort_order
      ),
      invoice_events: (invoice.invoice_events || []).sort(
        (a: InvoiceEvent, b: InvoiceEvent) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    };

    return { data: formattedInvoice, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch invoice" };
  }
}

/**
 * Calculate invoice totals from line items
 */
function calculateTotals(lineItems: Array<{ quantity: number; unit_price: number }>, taxRate: number = 10) {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

/**
 * Generate display ID for invoice (INV-XXXX format)
 */
async function generateDisplayId(supabase: any, orgId: string): Promise<string> {
  const { data: maxInvoice, error: maxError } = await supabase
    .from("invoices")
    .select("display_id")
    .eq("organization_id", orgId)
    .like("display_id", "INV-%")
    .order("display_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  let displayId = "INV-0001";
  if (!maxError && maxInvoice?.display_id) {
    const match = maxInvoice.display_id.match(/INV-(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      displayId = `INV-${String(num + 1).padStart(4, "0")}`;
    }
  }

  return displayId;
}

/**
 * Create a new invoice with line items
 */
export async function createInvoice(params: CreateInvoiceParams) {
  try {
    // Validate input
    const validated = validate(createInvoiceSchema, params);
    if (validated.error) {
      return { data: null, error: validated.error };
    }

    const supabase = await createServerSupabaseClient() as any;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Generate display_id
    const displayId = await generateDisplayId(supabase, params.organization_id);

    // Calculate totals
    const taxRate = params.tax_rate ?? 10;
    const { subtotal, tax, total } = calculateTotals(params.line_items, taxRate);

    // Create invoice
    const invoiceData = {
      organization_id: params.organization_id,
      display_id: displayId,
      client_id: params.client_id || null,
      job_id: params.job_id || null,
      client_name: params.client_name || null,
      client_email: params.client_email || null,
      client_address: params.client_address || null,
      status: params.status || "draft",
      issue_date: params.issue_date || null,
      due_date: params.due_date || null,
      subtotal,
      tax_rate: taxRate,
      tax,
      total,
      payment_link: params.payment_link || null,
      notes: params.notes || null,
      metadata: params.metadata || null,
      created_by: user.id,
    };

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      return { data: null, error: invoiceError.message };
    }

    // Create line items
    if (params.line_items && params.line_items.length > 0) {
      const lineItemsData = params.line_items.map((item, index) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: index,
      }));

      const { error: lineItemsError } = await supabase
        .from("invoice_line_items")
        .insert(lineItemsData);

      if (lineItemsError) {
        return { data: null, error: lineItemsError.message };
      }
    }

    // Create "created" event
    await supabase
      .from("invoice_events")
      .insert({
        invoice_id: invoice.id,
        type: "created",
        text: `Invoice ${displayId} was created`,
        metadata: null,
      });

    // Dispatch automation event
    dispatch(Events.invoiceCreated(invoice.organization_id, invoice.id, {
      display_id: invoice.display_id,
      client_id: invoice.client_id,
      client_name: invoice.client_name,
      total: invoice.total,
    }));

    revalidatePath("/dashboard/finance");
    return { data: invoice, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create invoice" };
  }
}

/**
 * Soft-delete an invoice (sets deleted_at timestamp)
 */
export async function deleteInvoice(invoiceId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", invoiceId);

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/finance");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Update invoice fields
 */
export async function updateInvoice(invoiceId: string, updates: UpdateInvoiceParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // If tax_rate is being updated, recalculate totals
    if (updates.tax_rate !== undefined) {
      const { data: currentInvoice } = await supabase
        .from("invoices")
        .select("invoice_line_items (quantity, unit_price)")
        .eq("id", invoiceId)
        .maybeSingle();

      if (currentInvoice?.invoice_line_items) {
        const { subtotal, tax, total } = calculateTotals(
          currentInvoice.invoice_line_items,
          updates.tax_rate
        );
        updates = {
          ...updates,
          subtotal,
          tax,
          total,
        } as any;
      }
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    revalidatePath("/dashboard/finance");
    return { data: invoice, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update invoice" };
  }
}

/**
 * Update invoice status and create appropriate event
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  newStatus: "draft" | "sent" | "paid" | "overdue" | "voided"
) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Get current invoice
    const { data: currentInvoice, error: fetchError } = await supabase
      .from("invoices")
      .select("display_id, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    // Prepare update data
    const updateData: any = { status: newStatus };
    if (newStatus === "paid") {
      updateData.paid_date = new Date().toISOString().split("T")[0];
    }

    const { data: invoice, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", invoiceId)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Create event based on status change
    const eventType = newStatus === "paid" ? "paid" : 
                     newStatus === "sent" ? "sent" :
                     newStatus === "voided" ? "voided" : 
                     "created";

    const eventText = newStatus === "paid" 
      ? `Invoice ${currentInvoice.display_id} was marked as paid`
      : newStatus === "sent"
      ? `Invoice ${currentInvoice.display_id} was sent`
      : newStatus === "voided"
      ? `Invoice ${currentInvoice.display_id} was voided`
      : `Invoice ${currentInvoice.display_id} status changed to ${newStatus}`;

    await supabase
      .from("invoice_events")
      .insert({
        invoice_id: invoiceId,
        type: eventType,
        text: eventText,
        metadata: { old_status: currentInvoice.status, new_status: newStatus },
      });

    // Dispatch automation events for invoice status changes
    const invoicePayload = {
      display_id: invoice.display_id,
      client_id: invoice.client_id,
      client_name: invoice.client_name,
      client_email: invoice.client_email,
      total: invoice.total,
      old_status: currentInvoice.status,
      new_status: newStatus,
    };

    if (newStatus === "paid") {
      dispatch(Events.invoicePaid(invoice.organization_id, invoiceId, invoicePayload));
    } else if (newStatus === "sent") {
      dispatch(Events.invoiceSent(invoice.organization_id, invoiceId, invoicePayload));
    } else if (newStatus === "overdue") {
      dispatch(Events.invoiceOverdue(invoice.organization_id, invoiceId, invoicePayload));
    }

    revalidatePath("/dashboard/finance");
    return { data: invoice, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update invoice status" };
  }
}

/**
 * Add a line item to an invoice and recalculate totals
 */
export async function addLineItem(invoiceId: string, item: AddLineItemParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Get current invoice and line items
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("tax_rate, invoice_line_items (quantity, unit_price, sort_order)")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      return { data: null, error: invoiceError.message };
    }

    // Get max sort_order
    const maxSortOrder = invoice.invoice_line_items?.length > 0
      ? Math.max(...invoice.invoice_line_items.map((li: any) => li.sort_order))
      : -1;

    // Add new line item
    const { data: lineItem, error: lineItemError } = await supabase
      .from("invoice_line_items")
      .insert({
        invoice_id: invoiceId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        sort_order: maxSortOrder + 1,
      })
      .select()
      .single();

    if (lineItemError) {
      return { data: null, error: lineItemError.message };
    }

    // Recalculate totals
    const allLineItems = [
      ...(invoice.invoice_line_items || []),
      { quantity: item.quantity, unit_price: item.unit_price },
    ];
    const { subtotal, tax, total } = calculateTotals(allLineItems, invoice.tax_rate);

    // Update invoice totals
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ subtotal, tax, total })
      .eq("id", invoiceId);

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    revalidatePath("/dashboard/finance");
    return { data: lineItem, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to add line item" };
  }
}

/**
 * Update a line item and recalculate invoice totals
 */
export async function updateLineItem(
  lineItemId: string,
  updates: { description?: string; quantity?: number; unit_price?: number }
) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    const { data: lineItem, error: updateError } = await supabase
      .from("invoice_line_items")
      .update(updates)
      .eq("id", lineItemId)
      .select("*, invoice_id")
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Recalculate invoice totals
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("tax_rate, invoice_line_items (quantity, unit_price)")
      .eq("id", lineItem.invoice_id)
      .maybeSingle();

    if (!invoiceError && invoice) {
      const { subtotal, tax, total } = calculateTotals(
        invoice.invoice_line_items || [],
        invoice.tax_rate
      );
      await supabase
        .from("invoices")
        .update({ subtotal, tax, total })
        .eq("id", lineItem.invoice_id);
    }

    revalidatePath("/dashboard/finance");
    return { data: lineItem, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update line item" };
  }
}

/**
 * Remove a line item from an invoice and recalculate totals
 */
export async function removeLineItem(lineItemId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: "Unauthorized" };
    }

    // Get line item to find invoice_id
    const { data: lineItem, error: lineItemError } = await supabase
      .from("invoice_line_items")
      .select("invoice_id")
      .eq("id", lineItemId)
      .maybeSingle();

    if (lineItemError) {
      return { data: null, error: lineItemError.message };
    }

    // Delete line item
    const { error: deleteError } = await supabase
      .from("invoice_line_items")
      .delete()
      .eq("id", lineItemId);

    if (deleteError) {
      return { data: null, error: deleteError.message };
    }

    // Get remaining line items and recalculate totals
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("tax_rate, invoice_line_items (quantity, unit_price)")
      .eq("id", lineItem.invoice_id)
      .maybeSingle();

    if (invoiceError) {
      return { data: null, error: invoiceError.message };
    }

    const { subtotal, tax, total } = calculateTotals(
      invoice.invoice_line_items || [],
      invoice.tax_rate
    );

    // Update invoice totals
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ subtotal, tax, total })
      .eq("id", lineItem.invoice_id);

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    revalidatePath("/dashboard/finance");
    return { data: { success: true }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to remove line item" };
  }
}

/**
 * Get all payouts for an organization
 */
export async function getPayouts(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    const { data: payouts, error } = await supabase
      .from("payouts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: payouts, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch payouts" };
  }
}

/**
 * Get daily revenue statistics for the last 30 days
 */
export async function getRevenueStats(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;
    
    // Calculate date range (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Get all paid invoices from the last 30 days
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("paid_date, total")
      .eq("organization_id", orgId)
      .eq("status", "paid")
      .not("paid_date", "is", null)
      .gte("paid_date", startDate.toISOString().split("T")[0])
      .lte("paid_date", endDate.toISOString().split("T")[0]);

    if (error) {
      return { data: null, error: error.message };
    }

    // Aggregate revenue by date
    const revenueByDate: Record<string, number> = {};
    
    // Initialize all dates in range with 0
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      revenueByDate[dateStr] = 0;
    }

    // Sum revenue by date
    invoices?.forEach((invoice: any) => {
      if (invoice.paid_date) {
        const dateStr = invoice.paid_date.split("T")[0];
        if (revenueByDate[dateStr] !== undefined) {
          revenueByDate[dateStr] += parseFloat(invoice.total) || 0;
        }
      }
    });

    // Convert to array format
    const stats: RevenueStat[] = Object.entries(revenueByDate)
      .map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { data: stats, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch revenue stats" };
  }
}

/* ── RPC-backed Operations ─────────────────────────────── */

/**
 * Get finance overview dashboard stats via RPC
 */
export async function getFinanceOverview(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_finance_overview", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("get_finance_overview RPC failed", "finance", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: data as FinanceOverview, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch finance overview" };
  }
}

/**
 * Create invoice with line items via RPC (transactional)
 */
export async function createInvoiceFull(params: CreateInvoiceParams) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const items = (params.line_items || []).map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
    }));

    const { data: result, error: rpcError } = await supabase.rpc("create_invoice_full", {
      p_org_id: params.organization_id,
      p_client_id: params.client_id || null,
      p_client_name: params.client_name || null,
      p_client_email: params.client_email || null,
      p_client_address: params.client_address || null,
      p_status: params.status || "draft",
      p_issue_date: params.issue_date || new Date().toISOString().split("T")[0],
      p_due_date: params.due_date || null,
      p_tax_rate: params.tax_rate ?? 10,
      p_notes: params.notes || null,
      p_payment_link: params.payment_link || null,
      p_items: JSON.stringify(items),
      p_created_by: user.id,
    });

    if (rpcError) {
      logger.error("create_invoice_full RPC failed, falling back", "finance", undefined, { error: rpcError.message });
      return createInvoice(params);
    }

    // Dispatch automation events
    dispatch(Events.invoiceCreated(params.organization_id, result.invoice_id, {
      display_id: result.display_id,
      client_id: params.client_id,
      client_name: params.client_name,
      total: result.total,
    }));

    if (params.status === "sent") {
      dispatch(Events.invoiceSent(params.organization_id, result.invoice_id, {
        display_id: result.display_id,
        client_id: params.client_id,
        client_name: params.client_name,
        client_email: params.client_email,
        total: result.total,
      }));
    }

    revalidatePath("/dashboard/finance");
    return { data: result, error: null };
  } catch (error: any) {
    logger.error("Failed to create invoice (full)", "finance", error);
    return { data: null, error: error.message || "Failed to create invoice" };
  }
}

/**
 * Get full invoice detail via RPC
 */
export async function getInvoiceDetail(invoiceId: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("get_invoice_detail", {
      p_invoice_id: invoiceId,
    });

    if (error) {
      logger.error("get_invoice_detail RPC failed, falling back", "finance", undefined, { error: error.message });
      return getInvoice(invoiceId);
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch invoice detail" };
  }
}

/**
 * Run overdue watchdog: marks sent invoices past due date as overdue
 */
export async function runOverdueWatchdog(orgId?: string) {
  try {
    const supabase = await createServerSupabaseClient() as any;

    const { data, error } = await supabase.rpc("mark_overdue_invoices", {
      p_org_id: orgId || null,
    });

    if (error) {
      logger.error("mark_overdue_invoices RPC failed", "finance", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    if (data?.marked_overdue > 0) {
      revalidatePath("/dashboard/finance");
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to run overdue watchdog" };
  }
}
