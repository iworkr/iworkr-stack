import { z } from "zod";

export const MemberRoleSchema = z.enum(["owner", "admin", "manager", "member", "viewer"]);
export const MemberStatusSchema = z.enum(["active", "invited", "suspended", "deactivated"]);

export const OrganizationMemberSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: MemberRoleSchema.catch("member"),
  status: MemberStatusSchema.catch("active"),
  display_name: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  job_title: z.string().nullable().optional(),
  hourly_rate: z.number().min(0).nullable().optional(),
  skills: z.array(z.string()).catch([]),
  created_at: z.string(),
  updated_at: z.string().nullable().optional(),
});

export const TeamMemberStatusSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string(),
  initials: z.string(),
  avatar_url: z.string().nullable().optional(),
  status: z.enum(["on_job", "en_route", "idle"]).catch("idle"),
  current_task: z.string().nullable().optional(),
});

export const TechnicianSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  initials: z.string(),
  status: z.enum(["online", "away", "offline"]).catch("offline"),
  hoursBooked: z.number().min(0).catch(0),
  hoursAvailable: z.number().min(0).catch(8),
  avatar_url: z.string().nullable().optional(),
});

export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;
export type TeamMemberStatus = z.infer<typeof TeamMemberStatusSchema>;
export type Technician = z.infer<typeof TechnicianSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
