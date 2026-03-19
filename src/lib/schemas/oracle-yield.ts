import { z } from "zod";

/* ── Yield Profile Schema ────────────────────────────── */

export const YieldProfileSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  profile_name: z.string().min(1),
  trade_category: z.string().nullable().optional(),
  base_margin: z.number().min(0).max(1),
  min_margin_floor: z.number().min(0).max(1),
  max_margin_ceiling: z.number().min(0).max(1),
  sensitivity_weight_fleet: z.number().min(0),
  sensitivity_weight_weather: z.number().min(0),
  sensitivity_weight_client: z.number().min(0),
  is_active: z.boolean(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type YieldProfile = z.infer<typeof YieldProfileSchema>;

/* ── Quote Yield Log Schema ──────────────────────────── */

export const QuoteYieldLogSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable().optional(),
  proposal_id: z.string().uuid().nullable().optional(),
  yield_profile_id: z.string().uuid().nullable().optional(),
  fleet_utilization_at_calc: z.number().nullable().optional(),
  weather_severity_index: z.number().nullable().optional(),
  weather_description: z.string().nullable().optional(),
  client_historical_conversion: z.number().nullable().optional(),
  surge_modifier: z.number().nullable().optional(),
  base_margin_used: z.number().nullable().optional(),
  raw_margin_calculated: z.number().nullable().optional(),
  calculated_margin_applied: z.number(),
  margin_floor_used: z.number().nullable().optional(),
  margin_ceiling_used: z.number().nullable().optional(),
  was_clamped: z.boolean().optional(),
  clamp_direction: z.string().nullable().optional(),
  human_override: z.boolean().optional(),
  human_override_margin: z.number().nullable().optional(),
  override_reason: z.string().nullable().optional(),
  calculation_time_ms: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type QuoteYieldLog = z.infer<typeof QuoteYieldLogSchema>;

/* ── Dynamic Yield Calculation Result ────────────────── */

export const DynamicYieldResultSchema = z.object({
  margin: z.number(),
  base_margin: z.number(),
  surge_modifier: z.number(),
  raw_margin: z.number(),
  fleet_utilization: z.number(),
  weather_severity: z.number(),
  weather_description: z.string().optional(),
  client_elasticity: z.number(),
  was_clamped: z.boolean(),
  clamp_direction: z.string().nullable(),
  margin_floor: z.number(),
  margin_ceiling: z.number(),
  profile_id: z.string().uuid(),
  profile_name: z.string(),
});
export type DynamicYieldResult = z.infer<typeof DynamicYieldResultSchema>;

/* ── NDIS Claim Prediction Schema ────────────────────── */

export const ClaimPredictionStatusSchema = z.enum([
  "INTERCEPTED",
  "OVERRIDDEN_BY_HUMAN",
  "FIXED_AND_RESUBMITTED",
  "AUTO_PASSED",
  "FALSE_POSITIVE_CONFIRMED",
]);

export const NdisClaimPredictionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  invoice_id: z.string().uuid().nullable().optional(),
  timesheet_id: z.string().uuid().nullable().optional(),
  claim_batch_id: z.string().uuid().nullable().optional(),
  participant_id: z.string().uuid().nullable().optional(),
  worker_id: z.string().uuid().nullable().optional(),
  support_item_code: z.string().nullable().optional(),
  shift_date: z.string().nullable().optional(),
  claim_amount: z.number().nullable().optional(),
  confidence_score_success: z.number().min(0).max(1),
  confidence_score_reject: z.number().min(0).max(1).optional(),
  predicted_error_code: z.string().nullable().optional(),
  predicted_error_category: z.string().nullable().optional(),
  flagged_reason: z.string(),
  ai_suggested_fix: z.string().nullable().optional(),
  ai_suggested_code: z.string().nullable().optional(),
  ai_suggested_amount: z.number().nullable().optional(),
  status: ClaimPredictionStatusSchema,
  resolved_by: z.string().uuid().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  resolution_action: z.string().nullable().optional(),
  model_version: z.string().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type NdisClaimPrediction = z.infer<typeof NdisClaimPredictionSchema>;

/* ── ML Feedback Schema ──────────────────────────────── */

export const OracleMlFeedbackSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  prediction_id: z.string().uuid().nullable().optional(),
  prediction_type: z.string(),
  predicted_outcome: z.string(),
  actual_outcome: z.string().nullable().optional(),
  was_correct: z.boolean().nullable().optional(),
  feedback_source: z.string().optional(),
  model_version: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type OracleMlFeedback = z.infer<typeof OracleMlFeedbackSchema>;
