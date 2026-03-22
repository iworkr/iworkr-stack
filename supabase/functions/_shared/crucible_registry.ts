/**
 * @module CrucibleRegistry
 * @status COMPLETE
 * @description Zod schema registry for edge function payload validation
 * @lastAudit 2026-03-22
 */
import { z } from "npm:zod@3.23.8";

export const CrucibleEdgeSchemas = {
  "twilio-webhook": z.object({
    MessageSid: z.string().min(5),
    From: z.string().min(3),
    Body: z.string().min(1),
  }),
  "webhooks-ingest": z.object({
    event_type: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  }),
  "automation-worker": z.object({}).passthrough(),
  "outrider-en-route-notify": z.object({
    worker_id: z.string().uuid(),
  }).passthrough(),
} as const;

