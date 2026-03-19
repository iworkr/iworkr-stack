import { z } from "zod";

export const ScheduleBlockStatusSchema = z.enum([
  "scheduled", "en_route", "on_site", "in_progress", "complete", "cancelled",
]);

export const ScheduleBlockRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  technician_id: z.string().uuid(),
  title: z.string(),
  client_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  status: ScheduleBlockStatusSchema.catch("scheduled"),
  travel_minutes: z.number().min(0).catch(0),
  notes: z.string().nullable().optional(),
  is_shadow_shift: z.boolean().catch(false),
  parent_shift_id: z.string().uuid().nullable().optional(),
  participant_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const ScheduleEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(["break", "meeting", "personal", "unavailable"]).catch("break"),
  title: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().nullable().optional(),
});

export const BacklogJobSchema = z.object({
  id: z.string().uuid(),
  display_id: z.string().nullable().optional(),
  title: z.string(),
  client_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  estimated_duration_minutes: z.number().nullable().optional(),
});

export type ScheduleBlockRow = z.infer<typeof ScheduleBlockRowSchema>;
export type ScheduleEvent = z.infer<typeof ScheduleEventSchema>;
export type BacklogJob = z.infer<typeof BacklogJobSchema>;
