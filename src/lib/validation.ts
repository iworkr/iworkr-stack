import { z } from "zod";

/* ── Common Schemas ──────────────────────────────────── */

export const uuidSchema = z.string().uuid("Invalid ID format");

export const emailSchema = z.string().email("Invalid email address").max(255);

export const phoneSchema = z
  .string()
  .max(30)
  .regex(/^[+\d\s()-]*$/, "Invalid phone number format")
  .optional()
  .or(z.literal(""));

export const companyNameSchema = z
  .string()
  .min(2, "Company name must be at least 2 characters")
  .max(50, "Company name must be under 50 characters")
  .regex(
    /^[a-zA-Z0-9\s&'.,-]+$/,
    "Only letters, numbers, spaces, and basic punctuation allowed"
  );

export const inviteEmailSchema = z
  .string()
  .email("Enter a valid email address")
  .refine(
    (email) => !email.endsWith("@example.com"),
    "Please use a real email address"
  );

/* ── Job Schemas ─────────────────────────────────────── */

export const jobStatusSchema = z.enum(["backlog", "todo", "in_progress", "done", "cancelled"]);
export const jobPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);

export const createJobSchema = z.object({
  organization_id: uuidSchema,
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(5000).optional().nullable(),
  status: jobStatusSchema.optional().default("backlog"),
  priority: jobPrioritySchema.optional().default("none"),
  client_id: uuidSchema.optional().nullable(),
  assignee_id: uuidSchema.optional().nullable(),
  due_date: z.string().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  labels: z.array(z.string().max(50)).max(20).optional().default([]),
  revenue: z.number().min(0).max(99999999).optional().nullable(),
  cost: z.number().min(0).max(99999999).optional().nullable(),
  estimated_hours: z.number().min(0).max(9999).optional().nullable(),
  actual_hours: z.number().min(0).max(9999).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: jobStatusSchema.optional(),
  priority: jobPrioritySchema.optional(),
  client_id: uuidSchema.optional().nullable(),
  assignee_id: uuidSchema.optional().nullable(),
  due_date: z.string().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  revenue: z.number().min(0).max(99999999).optional().nullable(),
  cost: z.number().min(0).max(99999999).optional().nullable(),
  estimated_hours: z.number().min(0).max(9999).optional().nullable(),
  actual_hours: z.number().min(0).max(9999).optional().nullable(),
});

/* ── Client Schemas ──────────────────────────────────── */

export const clientStatusSchema = z.enum(["active", "lead", "churned", "inactive"]);
export const clientTypeSchema = z.enum(["residential", "commercial"]);

export const createClientSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1, "Name is required").max(200),
  email: emailSchema.optional().or(z.literal("")),
  phone: phoneSchema,
  status: clientStatusSchema.optional().default("lead"),
  type: clientTypeSchema.optional().default("residential"),
  address: z.string().max(500).optional().nullable(),
  address_lat: z.number().min(-90).max(90).optional().nullable(),
  address_lng: z.number().min(-180).max(180).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
});

/* ── Invoice Schemas ─────────────────────────────────── */

export const invoiceStatusSchema = z.enum(["draft", "sent", "paid", "overdue", "voided"]);

export const createInvoiceSchema = z.object({
  organization_id: uuidSchema,
  client_id: uuidSchema.optional().nullable(),
  job_id: uuidSchema.optional().nullable(),
  client_name: z.string().max(200).optional(),
  client_email: emailSchema.optional().or(z.literal("")),
  client_address: z.string().max(500).optional(),
  due_date: z.string().min(1, "Due date is required"),
  notes: z.string().max(5000).optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional().default(10),
  line_items: z.array(z.object({
    description: z.string().min(1).max(500),
    quantity: z.number().min(0.01).max(99999),
    unit_price: z.number().min(0).max(99999999),
  })).min(1, "At least one line item required"),
});

/* ── Schedule Schemas ────────────────────────────────── */

export const scheduleBlockStatusSchema = z.enum(["scheduled", "en_route", "in_progress", "complete", "cancelled"]);

export const createScheduleBlockSchema = z.object({
  organization_id: uuidSchema,
  job_id: uuidSchema.optional().nullable(),
  technician_id: uuidSchema,
  title: z.string().min(1).max(200),
  client_name: z.string().max(200).optional(),
  location: z.string().max(500).optional(),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  travel_minutes: z.number().min(0).max(480).optional().default(0),
  notes: z.string().max(2000).optional(),
});

/* ── Automation Schemas ──────────────────────────────── */

export const createFlowSchema = z.object({
  organization_id: uuidSchema,
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(["marketing", "billing", "operations"]).optional().default("operations"),
  trigger_config: z.record(z.string(), z.unknown()).optional().default({}),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.enum(["trigger", "delay", "action", "condition"]),
    label: z.string(),
    config: z.record(z.string(), z.unknown()),
  })).optional().default([]),
});

/* ── Sanitization ────────────────────────────────────── */

/**
 * Strip potential XSS from user input strings.
 */
export function sanitize(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate and parse input with a Zod schema. Returns typed data or error.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { data: result.data, error: null };
  }
  const message = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
  return { data: null, error: message };
}

/* ── Type Exports ────────────────────────────────────── */

export type CompanyNameInput = z.infer<typeof companyNameSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateScheduleBlockInput = z.infer<typeof createScheduleBlockSchema>;
export type CreateFlowInput = z.infer<typeof createFlowSchema>;
