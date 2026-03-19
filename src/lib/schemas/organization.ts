import { z } from "zod";

export const IndustrySectorSchema = z.enum([
  "trades", "care", "cleaning", "landscaping", "electrical",
  "plumbing", "hvac", "general",
]).catch("trades");

export const OrganizationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().nullable().optional(),
  industry: IndustrySectorSchema,
  logo_url: z.string().url().nullable().optional(),
  timezone: z.string().catch("Australia/Sydney"),
  currency: z.string().catch("AUD"),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  abn: z.string().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).catch({}),
  plan_id: z.string().nullable().optional(),
  subscription_status: z.string().nullable().optional(),
  trial_ends_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const QuoteRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  quote_number: z.string().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  job_id: z.string().uuid().nullable().optional(),
  client_name: z.string().nullable().optional(),
  client_email: z.string().nullable().optional(),
  status: z.enum(["draft", "sent", "accepted", "declined", "expired"]).catch("draft"),
  subtotal: z.number().min(0).catch(0),
  tax_rate: z.number().min(0).max(100).catch(10),
  tax_amount: z.number().min(0).catch(0),
  total: z.number().min(0).catch(0),
  valid_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  secure_token: z.string().nullable().optional(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().min(0),
    unit_price: z.number().min(0),
  })).catch([]),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export type OrganizationRow = z.infer<typeof OrganizationRowSchema>;
export type QuoteRow = z.infer<typeof QuoteRowSchema>;
export type IndustrySector = z.infer<typeof IndustrySectorSchema>;
