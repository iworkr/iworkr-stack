import { z } from "zod";

export const ChartTypeSchema = z.enum([
  "BAR_CHART", "LINE_CHART", "DONUT_CHART", "METRIC_CARD", "DATA_TABLE",
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const RenderingPayloadSchema = z.object({
  executive_summary: z.string(),
  chart_type: ChartTypeSchema,
  x_axis_key: z.string(),
  y_axis_key: z.string(),
  y_axis_keys: z.array(z.string()).optional(),
  title: z.string().optional(),
});
export type RenderingPayload = z.infer<typeof RenderingPayloadSchema>;

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  sql_query: z.string().nullable().optional(),
  sql_error: z.string().nullable().optional(),
  retry_count: z.number().int().optional(),
  data_result: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  row_count: z.number().int().nullable().optional(),
  rendering: RenderingPayloadSchema.nullable().optional(),
  executive_summary: z.string().nullable().optional(),
  processing_ms: z.number().int().nullable().optional(),
  model_used: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().nullable().optional(),
  message_count: z.number().int().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const SSEStatusSchema = z.object({
  phase: z.string(),
  message: z.string(),
  error: z.string().optional(),
});

export const SSEResultSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
  rendering: RenderingPayloadSchema,
  sql_query: z.string(),
  reasoning: z.string().optional(),
  row_count: z.number().int(),
  retry_count: z.number().int().optional(),
  processing_ms: z.number().int(),
});
export type SSEResult = z.infer<typeof SSEResultSchema>;
