import { z } from "zod";

export const PayCategorySchema = z.enum([
  "ORDINARY", "OVERTIME_150", "OVERTIME_200", "ALLOWANCE",
  "PENALTY_SATURDAY", "PENALTY_SUNDAY", "PENALTY_PUBLIC_HOLIDAY",
  "SLEEPOVER", "ACTIVE_OVERNIGHT",
]);

export const TimesheetStatusSchema = z.enum([
  "draft", "submitted", "approved", "rejected", "paid",
]);

export const TimesheetRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  schedule_block_id: z.string().uuid().nullable().optional(),
  status: TimesheetStatusSchema.catch("draft"),
  clock_in: z.string(),
  clock_out: z.string().nullable().optional(),
  break_minutes: z.number().min(0).catch(0),
  total_hours: z.number().min(0).catch(0),
  notes: z.string().nullable().optional(),
  approved_by: z.string().uuid().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const TimesheetPayLineSchema = z.object({
  id: z.string().uuid(),
  timesheet_id: z.string().uuid().optional(),
  worker_id: z.string().uuid(),
  pay_category: PayCategorySchema,
  duration_hours: z.number().min(0).max(24),
  hourly_rate: z.number().min(0),
  total_amount: z.number().min(0),
  multiplier: z.number().min(0).catch(1),
  description: z.string().nullable().optional(),
});

export type TimesheetRow = z.infer<typeof TimesheetRowSchema>;
export type TimesheetPayLine = z.infer<typeof TimesheetPayLineSchema>;
export type PayCategory = z.infer<typeof PayCategorySchema>;
export type TimesheetStatus = z.infer<typeof TimesheetStatusSchema>;
