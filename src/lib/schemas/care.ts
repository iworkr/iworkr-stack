import { z } from "zod";

export const ParticipantRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  ndis_number: z.string().nullable().optional(),
  name: z.string(),
  date_of_birth: z.string().nullable().optional(),
  primary_disability: z.string().nullable().optional(),
  plan_manager: z.string().nullable().optional(),
  support_coordinator: z.string().nullable().optional(),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  goals: z.array(z.string()).catch([]),
  notes: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "waitlist", "exited"]).catch("active"),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const FundingBucketSchema = z.object({
  id: z.string().uuid(),
  participant_id: z.string().uuid(),
  category: z.string(),
  budget_total: z.number().min(0),
  budget_used: z.number().min(0).catch(0),
  budget_remaining: z.number().min(0).catch(0),
  start_date: z.string(),
  end_date: z.string(),
  is_active: z.boolean().catch(true),
});

export const CarePlanSchema = z.object({
  id: z.string().uuid(),
  participant_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["draft", "active", "review", "expired"]).catch("draft"),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  goals: z.array(z.object({
    id: z.string(),
    description: z.string(),
    status: z.enum(["not_started", "in_progress", "achieved"]).catch("not_started"),
    target_date: z.string().nullable().optional(),
  })).catch([]),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const IncidentReportSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid().nullable().optional(),
  reporter_id: z.string().uuid(),
  severity: z.enum(["low", "medium", "high", "critical"]).catch("medium"),
  category: z.string(),
  description: z.string(),
  location: z.string().nullable().optional(),
  occurred_at: z.string(),
  witnesses: z.array(z.string()).catch([]),
  actions_taken: z.string().nullable().optional(),
  follow_up_required: z.boolean().catch(false),
  status: z.enum(["open", "investigating", "resolved", "closed"]).catch("open"),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export type ParticipantRow = z.infer<typeof ParticipantRowSchema>;
export type FundingBucket = z.infer<typeof FundingBucketSchema>;
export type CarePlan = z.infer<typeof CarePlanSchema>;
export type IncidentReport = z.infer<typeof IncidentReportSchema>;
