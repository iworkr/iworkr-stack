import { z } from "zod";

/* ── OpenAI Function Calling Tool Schemas ────────────── */

export const LogMedicationSchema = z.object({
  medication_name: z.string().describe("Name of the medication administered"),
  dosage_amount: z.string().optional().describe("Dosage amount and unit, e.g. '10mg'"),
  approximate_time: z.string().optional().describe("Time of administration in HH:MM format"),
  was_refused: z.boolean().describe("Whether the participant refused the medication"),
  route: z.string().optional().describe("Route of administration: oral, topical, injection, etc."),
  prn_reason: z.string().optional().describe("Reason for PRN medication if applicable"),
});
export type LogMedication = z.infer<typeof LogMedicationSchema>;

export const CreateIncidentSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).describe("Severity level"),
  incident_type: z.string().describe("Category: behavioral, injury, property_damage, medication_error, abuse, neglect, restrictive_practice"),
  objective_description: z.string().describe("Court-ready, clinically objective description of the incident"),
  is_sirs_reportable: z.boolean().default(false).describe("Whether this requires SIRS reporting to NDIS Commission"),
  involves_restrictive_practice: z.boolean().default(false).describe("Whether a restrictive practice was used"),
  injuries_observed: z.string().optional().describe("Description of any injuries"),
});
export type CreateIncident = z.infer<typeof CreateIncidentSchema>;

export const LogGoalProgressSchema = z.object({
  goal_name: z.string().describe("Name or description of the participant goal"),
  progress_rating: z.enum(["EXCEEDED", "PROGRESSING", "MAINTAINED", "REGRESSED", "NOT_ADDRESSED"])
    .describe("Progress rating for this session"),
  observation: z.string().describe("Clinical observation of progress toward the goal"),
});
export type LogGoalProgress = z.infer<typeof LogGoalProgressSchema>;

export const DraftShiftNoteSchema = z.object({
  context_of_support: z.string().describe("Sanitized, professional description of the shift activities"),
  outcomes_achieved: z.string().optional().describe("Key outcomes or achievements during the shift"),
  risks_identified: z.string().optional().describe("Any risks or concerns identified"),
});
export type DraftShiftNote = z.infer<typeof DraftShiftNoteSchema>;

export const CreatePurchaseOrderSchema = z.object({
  supplier_name: z.string().optional().describe("Name of the supplier"),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit: z.string().optional(),
    estimated_cost: z.number().optional(),
  })).describe("Line items to order"),
  urgency: z.enum(["STANDARD", "URGENT", "CRITICAL"]).default("STANDARD"),
  delivery_notes: z.string().optional(),
});
export type CreatePurchaseOrder = z.infer<typeof CreatePurchaseOrderSchema>;

/* ── Semantic Router Response Schema ─────────────────── */

export const SemanticRouterActionSchema = z.object({
  action_type: z.enum(["shift_note", "medication", "incident", "goal_progress", "purchase_order"]),
  confidence: z.number().min(0).max(1),
  data: z.union([
    DraftShiftNoteSchema,
    LogMedicationSchema,
    CreateIncidentSchema,
    LogGoalProgressSchema,
    CreatePurchaseOrderSchema,
  ]),
  warnings: z.array(z.string()).optional(),
});
export type SemanticRouterAction = z.infer<typeof SemanticRouterActionSchema>;

export const SemanticRouterResponseSchema = z.object({
  actions: z.array(SemanticRouterActionSchema),
  sanitized_transcript: z.string(),
  overall_confidence: z.number().min(0).max(1),
  detected_sector: z.enum(["care", "trade"]).default("care"),
  tone_warnings: z.array(z.string()).optional(),
});
export type SemanticRouterResponse = z.infer<typeof SemanticRouterResponseSchema>;

/* ── Audio Debrief Schema ────────────────────────────── */

export const AudioDebriefStatusSchema = z.enum([
  "UPLOADING", "TRANSCRIBING", "ROUTING", "PENDING_REVIEW",
  "COMMITTED", "FAILED", "REJECTED",
]);

export const AudioDebriefSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  job_id: z.string().uuid().nullable().optional(),
  worker_id: z.string().uuid(),
  participant_id: z.string().uuid().nullable().optional(),
  audio_url: z.string(),
  audio_duration_sec: z.number().nullable().optional(),
  raw_transcript: z.string().nullable().optional(),
  sanitized_transcript: z.string().nullable().optional(),
  whisper_confidence: z.number().nullable().optional(),
  proposed_actions: z.array(z.record(z.string(), z.unknown())).optional(),
  committed_actions: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  overall_confidence: z.number().nullable().optional(),
  status: AudioDebriefStatusSchema,
  sector: z.enum(["care", "trade"]).optional(),
  created_at: z.string().nullable().optional(),
});
export type AudioDebrief = z.infer<typeof AudioDebriefSchema>;

/* ── Vision Hazard Scan Schema ───────────────────────── */

export const HazardDetectionSchema = z.object({
  hazard_type: z.string(),
  description: z.string(),
  likelihood: z.number().int().min(1).max(5),
  consequence: z.number().int().min(1).max(5),
  initial_risk_score: z.number().int(),
  control_measures: z.array(z.string()),
  residual_likelihood: z.number().int().min(1).max(5).optional(),
  residual_consequence: z.number().int().min(1).max(5).optional(),
  residual_risk_score: z.number().int().optional(),
  bounding_box: z.object({
    x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }).optional(),
  frame_index: z.number().int().optional(),
});
export type HazardDetection = z.infer<typeof HazardDetectionSchema>;

export const VisionSwmsResultSchema = z.object({
  hazards: z.array(HazardDetectionSchema),
  overall_site_risk: z.enum(["LOW", "MEDIUM", "HIGH", "EXTREME"]),
  recommended_ppe: z.array(z.string()),
  site_conditions: z.array(z.string()),
  summary: z.string(),
  model_used: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
export type VisionSwmsResult = z.infer<typeof VisionSwmsResultSchema>;
