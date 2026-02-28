"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/send";
import { createElement } from "react";
import { z } from "zod";
import { validate } from "@/lib/validation";

/* ── Schemas ──────────────────────────────────────────── */

const CreateQuoteSchema = z.object({
  organization_id: z.string().uuid(),
  client_id: z.string().uuid().optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  client_name: z.string().max(200).optional().nullable(),
  client_email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  client_address: z.string().max(500).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  valid_until: z.string().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  terms: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional().nullable(),
  line_items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().min(0.01).max(99999),
    unit_price: z.number().min(0).max(99999999),
  })).min(1, "At least one line item is required"),
});

const UpdateQuoteSchema = z.object({
  client_id: z.string().uuid().optional().nullable(),
  job_id: z.string().uuid().optional().nullable(),
  client_name: z.string().max(200).optional().nullable(),
  client_email: z.string().email().max(255).optional().nullable().or(z.literal("")),
  client_address: z.string().max(500).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  status: z.enum(["draft", "sent", "viewed", "accepted", "rejected", "expired"]).optional(),
  valid_until: z.string().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  terms: z.string().max(5000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).passthrough();

/* ── Types ────────────────────────────────────────────── */

export interface Quote {
  id: string;
  organization_id: string;
  display_id: string;
  secure_token: string;
  client_id: string | null;
  job_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_address: string | null;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired";
  title: string | null;
  issue_date: string;
  valid_until: string | null;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  terms: string | null;
  notes: string | null;
  signature_url: string | null;
  signed_at: string | null;
  signed_by: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  line_items?: QuoteLineItem[];
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number | null;
  sort_order: number;
}

export interface DocumentEvent {
  id: string;
  document_type: "quote" | "invoice";
  document_id: string;
  event_type: string;
  description: string | null;
  actor_name: string | null;
  actor_email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

/* ── Quotes CRUD ──────────────────────────────────────── */

export async function getQuotes(orgId: string): Promise<{ data: Quote[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as Quote[] };
}

export async function getQuote(quoteId: string): Promise<{ data: Quote | null; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) return { data: null, error: error.message };
  if (!quote) return { data: null };

  // Verify org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", quote.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: null, error: "Unauthorized" };

  const { data: items } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });

  return { data: { ...quote, line_items: (items || []) as QuoteLineItem[] } as Quote };
}

export async function createQuote(params: {
  organization_id: string;
  client_id?: string | null;
  job_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  client_address?: string | null;
  title?: string | null;
  valid_until?: string | null;
  tax_rate?: number;
  terms?: string;
  notes?: string | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number }>;
}): Promise<{ data: Quote | null; error?: string }> {
  // Validate input
  const validated = validate(CreateQuoteSchema, params);
  if (validated.error) return { data: null, error: validated.error };

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { line_items, ...quoteData } = params;
  const subtotal = line_items.reduce((sum, li) => sum + li.quantity * li.unit_price, 0);
  const taxRate = params.tax_rate ?? 10;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      ...quoteData,
      display_id: "",
      subtotal,
      tax_rate: taxRate,
      tax,
      total,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) return { data: null, error: error.message };

  if (line_items.length > 0) {
    await supabase.from("quote_line_items").insert(
      line_items.map((li, i) => ({
        quote_id: quote.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        sort_order: i,
      }))
    );
  }

  await logDocumentEvent(quote.organization_id, "quote", quote.id, "created", "Quote created", user?.email);

  revalidatePath("/dashboard/finance");
  return { data: quote as Quote };
}

export async function updateQuote(
  quoteId: string,
  updates: Partial<Omit<Quote, "id" | "display_id" | "secure_token" | "created_at" | "updated_at">>
): Promise<{ error?: string }> {
  // Validate input
  const validated = validate(UpdateQuoteSchema, updates);
  if (validated.error) return { error: validated.error };

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Fetch quote to verify org membership
  const { data: quote } = await supabase
    .from("quotes")
    .select("organization_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { error: "Quote not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", quote.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("quotes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/finance");
  return {};
}

export async function addQuoteLineItem(
  quoteId: string,
  item: { description: string; quantity: number; unit_price: number }
): Promise<{ data: QuoteLineItem | null; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Unauthorized" };

  const { data, error } = await supabase
    .from("quote_line_items")
    .insert({ quote_id: quoteId, ...item })
    .select()
    .single();

  if (error) return { data: null, error: error.message };
  await recalcQuoteTotals(quoteId);
  return { data: data as QuoteLineItem };
}

export async function removeQuoteLineItem(lineItemId: string, quoteId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("quote_line_items")
    .delete()
    .eq("id", lineItemId);

  if (error) return { error: error.message };
  await recalcQuoteTotals(quoteId);
  return {};
}

async function recalcQuoteTotals(quoteId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: items } = await supabase
    .from("quote_line_items")
    .select("quantity, unit_price")
    .eq("quote_id", quoteId);

  const { data: quote } = await supabase
    .from("quotes")
    .select("tax_rate")
    .eq("id", quoteId)
    .maybeSingle();

  const subtotal = (items || []).reduce((s: number, i: any) => s + i.quantity * i.unit_price, 0);
  const taxRate = quote?.tax_rate || 10;
  const tax = subtotal * (taxRate / 100);

  await supabase
    .from("quotes")
    .update({ subtotal, tax, total: subtotal + tax, updated_at: new Date().toISOString() })
    .eq("id", quoteId);
}

/* ── Send Quote ───────────────────────────────────────── */

export async function sendQuote(quoteId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: quote } = await supabase
    .from("quotes")
    .select("*, organization:organizations(name, logo_url)")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) return { error: "Quote not found" };

  // Verify org membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", quote.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  if (!quote.client_email) return { error: "No client email set" };

  if (!process.env.NEXT_PUBLIC_APP_URL) console.warn("[quotes] NEXT_PUBLIC_APP_URL is not set");
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/portal/view/${quote.secure_token}`;

  await sendEmail({
    to: quote.client_email,
    subject: `Quote ${quote.display_id} from ${quote.organization?.name || "iWorkr"}`,
    react: createElement("div", {
      style: { fontFamily: "Inter, sans-serif", backgroundColor: "#000", color: "#fff", padding: "40px" },
    },
      createElement("h1", { style: { fontSize: "24px", fontWeight: 500 } }, `Quote ${quote.display_id}`),
      createElement("p", { style: { color: "#A1A1AA", marginTop: "12px" } },
        `Hi ${quote.client_name || "there"}, please review the following estimate${quote.title ? ` for "${quote.title}"` : ""}.`),
      createElement("p", { style: { fontSize: "28px", fontWeight: 600, color: "#00E676", margin: "24px 0" } },
        `$${Number(quote.total).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`),
      createElement("a", {
        href: portalUrl,
        style: {
          display: "inline-block", padding: "14px 32px", backgroundColor: "#00E676",
          color: "#000", borderRadius: "12px", fontWeight: 600, textDecoration: "none", fontSize: "14px",
        },
      }, "Review & Approve"),
      createElement("p", { style: { color: "#52525B", fontSize: "12px", marginTop: "24px" } },
        "This link is unique to you. Do not share it.")
    ),
    tags: [{ name: "type", value: "quote" }, { name: "quote_id", value: quoteId }],
  });

  await supabase
    .from("quotes")
    .update({ status: "sent", updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  await logDocumentEvent(quote.organization_id, "quote", quoteId, "sent", `Sent to ${quote.client_email}`, null, quote.client_email);

  revalidatePath("/dashboard/finance");
  return {};
}

/* ── Public Portal Actions (no auth required) ─────────── */

export async function getDocumentByToken(token: string): Promise<{
  type: "quote" | "invoice" | null;
  data: any;
  lineItems: any[];
  orgName: string;
  orgLogo: string | null;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  // Try quotes first
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, organization:organizations(name, logo_url)")
    .eq("secure_token", token)
    .maybeSingle();

  if (quote) {
    const { data: items } = await supabase
      .from("quote_line_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order", { ascending: true });

    // Log view event
    if (quote.status === "sent") {
      await supabase.from("quotes").update({ status: "viewed" }).eq("id", quote.id);
    }
    await logDocumentEvent(quote.organization_id, "quote", quote.id, "viewed", "Client viewed quote");

    return {
      type: "quote",
      data: quote,
      lineItems: items || [],
      orgName: quote.organization?.name || "iWorkr",
      orgLogo: quote.organization?.logo_url,
    };
  }

  // Try invoices
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, organization:organizations(name, logo_url)")
    .eq("secure_token", token)
    .maybeSingle();

  if (invoice) {
    const { data: items } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoice.id)
      .order("sort_order", { ascending: true });

    await logDocumentEvent(invoice.organization_id, "invoice", invoice.id, "viewed", "Client viewed invoice");

    return {
      type: "invoice",
      data: invoice,
      lineItems: items || [],
      orgName: invoice.organization?.name || "iWorkr",
      orgLogo: invoice.organization?.logo_url,
    };
  }

  return { type: null, data: null, lineItems: [], orgName: "", orgLogo: null, error: "Document not found" };
}

export async function approveQuote(token: string, signatureDataUrl: string, signerName: string): Promise<{ invoiceToken?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("secure_token", token)
    .maybeSingle();

  if (!quote) return { error: "Quote not found" };
  if (quote.status === "accepted") return { error: "Already approved" };

  // Update quote to accepted — the DB trigger (trg_convert_accepted_quote)
  // automatically creates both a job AND a draft invoice with copied line items,
  // and sets job_id / invoice_id on the quote row.
  const { data: updated, error: updateErr } = await supabase.from("quotes").update({
    status: "accepted",
    signature_url: signatureDataUrl,
    signed_at: new Date().toISOString(),
    signed_by: signerName,
    updated_at: new Date().toISOString(),
  }).eq("id", quote.id).select("id, job_id, invoice_id").single();

  if (updateErr) return { error: updateErr.message };

  await logDocumentEvent(quote.organization_id, "quote", quote.id, "signed", `Signed by ${signerName}`);
  await logDocumentEvent(quote.organization_id, "quote", quote.id, "approved", "Quote approved — job and invoice auto-generated");

  // Read back the invoice to get its secure_token for the portal redirect
  if (updated?.invoice_id) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("secure_token")
      .eq("id", updated.invoice_id)
      .maybeSingle();

    await logDocumentEvent(quote.organization_id, "invoice", updated.invoice_id, "created", "Auto-created from approved quote");
    return { invoiceToken: invoice?.secure_token ?? undefined };
  }

  return {};
}

export async function rejectQuote(token: string, reason: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, organization_id")
    .eq("secure_token", token)
    .maybeSingle();

  if (!quote) return { error: "Quote not found" };

  await supabase.from("quotes").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", quote.id);
  await logDocumentEvent(quote.organization_id, "quote", quote.id, "rejected", `Declined: ${reason}`);
  return {};
}

/* ── Forensic Events ──────────────────────────────────── */

export async function getDocumentEvents(docType: "quote" | "invoice", docId: string): Promise<{ data: DocumentEvent[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  // Fetch the document to get org_id and verify membership
  const table = docType === "quote" ? "quotes" : "invoices";
  const { data: doc } = await supabase
    .from(table)
    .select("organization_id")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) return { data: [], error: "Document not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", doc.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("document_events")
    .select("*")
    .eq("document_type", docType)
    .eq("document_id", docId)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as DocumentEvent[] };
}

async function logDocumentEvent(
  orgId: string,
  docType: "quote" | "invoice",
  docId: string,
  eventType: string,
  description?: string | null,
  actorEmail?: string | null,
  recipientEmail?: string | null,
) {
  const supabase = await createServerSupabaseClient();
  await supabase.from("document_events").insert({
    organization_id: orgId,
    document_type: docType,
    document_id: docId,
    event_type: eventType,
    description,
    actor_email: actorEmail || recipientEmail,
  });
}
