import { z } from "zod";

export const DashboardStatsSchema = z.object({
  revenue_current: z.number().catch(0),
  revenue_previous: z.number().catch(0),
  revenue_growth_pct: z.number().catch(0),
  active_jobs_count: z.number().int().catch(0),
  unassigned_jobs_count: z.number().int().catch(0),
  total_jobs_count: z.number().int().catch(0),
});

export const DailyRevenuePointSchema = z.object({
  date: z.string(),
  amount: z.number().catch(0),
  invoice_count: z.number().int().catch(0),
});

export const ScheduleItemSchema = z.object({
  id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  title: z.string(),
  client_name: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  status: z.string(),
  travel_minutes: z.number().catch(0),
  notes: z.string().nullable().optional(),
});

export const AIInsightSchema = z.object({
  type: z.enum(["warning", "alert", "info", "success"]).catch("info"),
  title: z.string(),
  body: z.string(),
  action: z.string().nullable().optional(),
  action_route: z.string().nullable().optional(),
  priority: z.number().catch(0),
});

export const DispatchPinSchema = z.object({
  id: z.string(),
  task: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  job_status: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  location_lat: z.number().nullable().optional(),
  location_lng: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
  technician_id: z.string().uuid().nullable().optional(),
  dispatch_status: z.enum(["on_job", "en_route", "idle", "offline"]).catch("offline"),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  battery: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  gps_status: z.string().nullable().optional(),
  position_updated_at: z.string().nullable().optional(),
  current_job_id: z.string().nullable().optional(),
});

export const DashboardSnapshotSchema = z.object({
  revenue: z.object({
    current: z.number().catch(0),
    previous: z.number().catch(0),
    growth_pct: z.number().catch(0),
    history: z.array(DailyRevenuePointSchema).catch([]),
  }),
  active_jobs: z.number().int().catch(0),
  inbox_count: z.number().int().catch(0),
  schedule: z.array(z.object({
    id: z.string().uuid(),
    job_id: z.string().uuid().nullable().optional(),
    title: z.string(),
    location: z.string().nullable().optional(),
    start_time: z.string(),
    end_time: z.string(),
    status: z.string(),
  })).catch([]),
  team: z.array(z.object({
    user_id: z.string().uuid(),
    name: z.string(),
    initials: z.string(),
    avatar_url: z.string().nullable().optional(),
    member_status: z.string(),
  })).catch([]),
});

export const DashboardLayoutItemSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  minW: z.number().int().optional(),
  minH: z.number().int().optional(),
  maxW: z.number().int().optional(),
  maxH: z.number().int().optional(),
});

export const DashboardLayoutSchema = z.array(DashboardLayoutItemSchema);

export const FootprintTrailRowSchema = z.object({
  technician_id: z.string().uuid(),
  path: z.array(z.object({ lat: z.number(), lng: z.number() })),
  timestamps: z.array(z.number()).nullable().optional(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DailyRevenuePoint = z.infer<typeof DailyRevenuePointSchema>;
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;
export type AIInsight = z.infer<typeof AIInsightSchema>;
export type DispatchPin = z.infer<typeof DispatchPinSchema>;
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;
export type DashboardLayoutItem = z.infer<typeof DashboardLayoutItemSchema>;
export type FootprintTrailRow = z.infer<typeof FootprintTrailRowSchema>;
