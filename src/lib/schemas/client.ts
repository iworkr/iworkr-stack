import { z } from "zod";

export const ClientStatusSchema = z.enum(["active", "lead", "churned", "inactive"]);
export const ClientTypeSchema = z.enum(["residential", "commercial"]);

export const ClientRowSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: ClientStatusSchema.catch("lead"),
  type: ClientTypeSchema.catch("residential"),
  address: z.string().nullable().optional(),
  address_lat: z.number().nullable().optional(),
  address_lng: z.number().nullable().optional(),
  tags: z.array(z.string()).catch([]),
  notes: z.string().nullable().optional(),
  lifetime_value: z.number().nullable().optional(),
  total_jobs: z.number().int().nullable().optional(),
  last_job_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const ClientContactSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  name: z.string(),
  role: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_primary: z.boolean().catch(false),
});

export const ClientActivityLogSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  actor_id: z.string().uuid().nullable(),
  actor_name: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).catch({}),
  created_at: z.string(),
});

export type ClientRow = z.infer<typeof ClientRowSchema>;
export type ClientContact = z.infer<typeof ClientContactSchema>;
export type ClientActivityLog = z.infer<typeof ClientActivityLogSchema>;
export type ClientStatus = z.infer<typeof ClientStatusSchema>;
export type ClientType = z.infer<typeof ClientTypeSchema>;
