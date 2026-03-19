import { z } from "zod";

/* ── Enums ────────────────────────────────────────────── */

export const AnomalyTypeSchema = z.enum([
  "VEHICLE_BREAKDOWN", "MEDICAL_EMERGENCY", "JOB_OVERRUN",
  "TRAFFIC_SEVERE", "NO_SHOW", "WEATHER_EMERGENCY",
]);
export type AnomalyType = z.infer<typeof AnomalyTypeSchema>;

export const AnomalyStatusSchema = z.enum([
  "DETECTED", "ANALYZING_SPATIAL", "EXECUTING_ARBITRATION",
  "NEGOTIATING_CLIENT", "RESOLVED", "MANUAL_OVERRIDE", "FAILED",
]);
export type AnomalyStatus = z.infer<typeof AnomalyStatusSchema>;

export const NegotiationStatusSchema = z.enum([
  "SMS_DISPATCHED", "AWAITING_CLIENT", "NEGOTIATING",
  "SUCCESSFULLY_MOVED", "FAILED_ESCALATED", "CANCELLED",
]);
export type NegotiationStatus = z.infer<typeof NegotiationStatusSchema>;

/* ── Fleet Anomaly Schema ────────────────────────────── */

export const FleetAnomalySchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  worker_name: z.string().nullable().optional(),
  anomaly_type: AnomalyTypeSchema,
  delay_minutes: z.number().int().min(0),
  reported_at: z.string(),
  impacted_job_ids: z.array(z.string().uuid()).optional(),
  impacted_job_count: z.number().int().optional(),
  resolved_job_ids: z.array(z.string().uuid()).optional(),
  arbitration_log: z.array(z.record(z.string(), z.unknown())).optional(),
  status: AnomalyStatusSchema,
  autopilot_active: z.boolean().optional(),
  created_at: z.string().nullable().optional(),
});
export type FleetAnomaly = z.infer<typeof FleetAnomalySchema>;

/* ── Autonomous Negotiation Schema ───────────────────── */

export const AutonomousNegotiationSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  anomaly_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  client_name: z.string().nullable().optional(),
  client_phone: z.string().nullable().optional(),
  conversation_history: z.array(z.record(z.string(), z.unknown())).optional(),
  turn_count: z.number().int().optional(),
  client_sentiment: z.number().min(0).max(1).optional(),
  original_datetime: z.string().nullable().optional(),
  proposed_datetime: z.string().nullable().optional(),
  accepted_datetime: z.string().nullable().optional(),
  status: NegotiationStatusSchema,
  escalation_reason: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type AutonomousNegotiation = z.infer<typeof AutonomousNegotiationSchema>;

/* ── Arbitration Event Schema ────────────────────────── */

export const ArbitrationEventSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  anomaly_id: z.string().uuid().nullable().optional(),
  event_type: z.string(),
  severity: z.enum(["info", "success", "warning", "error", "critical"]),
  message: z.string(),
  job_id: z.string().uuid().nullable().optional(),
  worker_id: z.string().uuid().nullable().optional(),
  target_worker_id: z.string().uuid().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string(),
});
export type ArbitrationEvent = z.infer<typeof ArbitrationEventSchema>;

/* ── LLM Function Calling Tool Schemas ───────────────── */

export const ExecuteRescheduleSchema = z.object({
  new_iso_datetime: z.string().describe("ISO-8601 datetime for the new appointment"),
  reply_message_to_client: z.string().describe("Polite confirmation message to send back to the client"),
});
export type ExecuteReschedule = z.infer<typeof ExecuteRescheduleSchema>;

export const AcceptDelaySchema = z.object({
  reply_message_to_client: z.string().describe("Polite acknowledgment message"),
  confirmed_eta: z.string().describe("The new ETA in ISO-8601 format"),
});
export type AcceptDelay = z.infer<typeof AcceptDelaySchema>;

export const EscalateToHumanSchema = z.object({
  sentiment_score: z.number().min(0).max(1).describe("Client sentiment: 0.0 = furious, 1.0 = happy"),
  reason_for_escalation: z.string().describe("Why this requires human intervention"),
  reply_message_to_client: z.string().describe("Calming message before human takes over"),
});
export type EscalateToHuman = z.infer<typeof EscalateToHumanSchema>;

/* ── Spatial Match Result ────────────────────────────── */

export const SpatialMatchSchema = z.object({
  worker_id: z.string().uuid(),
  worker_name: z.string(),
  distance_meters: z.number(),
  skills: z.array(z.string()),
  available_from: z.string(),
  available_until: z.string(),
});
export type SpatialMatch = z.infer<typeof SpatialMatchSchema>;

/* ── Blast Radius Result ─────────────────────────────── */

export const BlastRadiusJobSchema = z.object({
  job_id: z.string().uuid().nullable(),
  job_title: z.string().nullable().optional(),
  client_name: z.string().nullable().optional(),
  start_time: z.string(),
  end_time: z.string(),
  new_eta: z.string(),
  delay_overflow: z.number().int(),
  location: z.string().nullable().optional(),
});
export type BlastRadiusJob = z.infer<typeof BlastRadiusJobSchema>;
