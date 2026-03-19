import { z } from "zod";

export const InvoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "voided"]);

export const InvoiceLineItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string(),
  quantity: z.number().min(0),
  unit_price: z.number().min(0),
  total: z.number().optional(),
});

export const InvoiceRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  invoice_number: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  client_name: z.string().nullable().optional(),
  client_email: z.string().nullable().optional(),
  client_address: z.string().nullable().optional(),
  status: InvoiceStatusSchema.catch("draft"),
  subtotal: z.number().min(0).catch(0),
  tax_rate: z.number().min(0).max(100).catch(10),
  tax_amount: z.number().min(0).catch(0),
  total: z.number().min(0).catch(0),
  amount_paid: z.number().min(0).catch(0),
  due_date: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  line_items: z.array(InvoiceLineItemSchema).catch([]),
  stripe_payment_intent_id: z.string().nullable().optional(),
  xero_invoice_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export type InvoiceRow = z.infer<typeof InvoiceRowSchema>;
export type InvoiceLineItem = z.infer<typeof InvoiceLineItemSchema>;
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
