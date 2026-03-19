import { z } from "zod";

export const JobStatusSchema = z.enum([
  "backlog", "todo", "scheduled", "en_route", "on_site",
  "in_progress", "done", "completed", "invoiced", "archived", "cancelled", "urgent",
]);

export const JobPrioritySchema = z.enum(["urgent", "high", "medium", "low", "none"]);

export const JobRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  display_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: JobStatusSchema.catch("backlog"),
  priority: JobPrioritySchema.catch("none"),
  client_id: z.string().uuid().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  due_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  labels: z.array(z.string()).catch([]),
  revenue: z.number().nullable().optional(),
  cost: z.number().nullable().optional(),
  estimated_hours: z.number().nullable().optional(),
  actual_hours: z.number().nullable().optional(),
  estimated_duration_minutes: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const JobWithClientSchema = JobRowSchema.extend({
  client: z.object({
    name: z.string(),
    email: z.string().nullable().optional(),
  }).nullable().optional(),
});

export type JobRow = z.infer<typeof JobRowSchema>;
export type JobWithClient = z.infer<typeof JobWithClientSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobPriority = z.infer<typeof JobPrioritySchema>;
