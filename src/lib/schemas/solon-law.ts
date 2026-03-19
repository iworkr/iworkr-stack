import { z } from "zod";

/* ── Enums ────────────────────────────────────────────── */

export const FrameworkStatusSchema = z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]);
export const ComplianceModeSchema = z.enum(["ADVISORY", "HARD_STOP"]);
export const InterceptResultSchema = z.enum([
  "COMPLIANT", "VIOLATION_DETECTED", "LOW_CONFIDENCE", "ERROR",
]);

/* ── Regulatory Framework ────────────────────────────── */

export const RegulatoryFrameworkSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  version_code: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sector: z.enum(["care", "trade", "both"]).optional(),
  effective_date: z.string(),
  expiry_date: z.string().nullable().optional(),
  source_pdf_url: z.string().nullable().optional(),
  total_chunks: z.number().int().optional(),
  status: FrameworkStatusSchema,
  ingestion_status: z.string().optional(),
  ingested_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type RegulatoryFramework = z.infer<typeof RegulatoryFrameworkSchema>;

/* ── Regulatory Chunk ────────────────────────────────── */

export const RegulatoryChunkSchema = z.object({
  id: z.string().uuid(),
  framework_id: z.string().uuid(),
  chunk_index: z.number().int(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  similarity: z.number().optional(),
});
export type RegulatoryChunk = z.infer<typeof RegulatoryChunkSchema>;

/* ── Violation ───────────────────────────────────────── */

export const ViolationSchema = z.object({
  clause_reference: z.string(),
  human_explanation: z.string(),
  actionable_fix: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
export type Violation = z.infer<typeof ViolationSchema>;

/* ── RAG Intercept Result ────────────────────────────── */

export const ComplianceEvaluationSchema = z.object({
  is_compliant: z.boolean(),
  confidence_flag: z.enum(["HIGH", "MEDIUM", "LOW"]).default("HIGH"),
  violations: z.array(ViolationSchema).default([]),
  matched_chunks: z.array(z.object({
    chunk_id: z.string(),
    framework_title: z.string().optional(),
    content: z.string(),
    similarity: z.number(),
  })).optional(),
  model_used: z.string().optional(),
  processing_ms: z.number().optional(),
});
export type ComplianceEvaluation = z.infer<typeof ComplianceEvaluationSchema>;

/* ── Compliance Intercept Log ────────────────────────── */

export const ComplianceInterceptLogSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  context_type: z.string(),
  context_id: z.string().uuid().nullable().optional(),
  serialized_intent: z.string(),
  result: InterceptResultSchema,
  confidence_flag: z.string().optional(),
  violations: z.array(ViolationSchema).optional(),
  was_overridden: z.boolean().optional(),
  override_reason: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type ComplianceInterceptLog = z.infer<typeof ComplianceInterceptLogSchema>;
