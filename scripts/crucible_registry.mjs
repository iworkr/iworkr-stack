import { z } from "zod";

const uuid = z.string().uuid();
const nonEmpty = z.string().min(1);
const GenericSchema = z.record(z.string(), z.unknown());

const publicWebhookNames = new Set([
  "twilio-webhook",
  "stripe-webhook",
  "polar-webhook",
  "revenuecat-webhook",
  "resend-webhook",
  "webhooks-ingest",
  "inbound-email-webhook",
  "twilio-voice-status",
  "twilio-voice-inbound",
]);

export const CrucibleRegistry = {
  "smart-roster-match": {
    schema: z.object({
      blueprint_id: uuid,
      execute_assignment: z.boolean(),
    }),
    generateHappy: (s) => ({
      blueprint_id: s.care_blueprint_id,
      execute_assignment: true,
    }),
  },
  "generate-swms-pdf": {
    schema: z.object({
      job_id: uuid,
      hazard_matrix: z.array(z.record(z.string(), z.unknown())).min(1),
    }),
    generateHappy: (s) => ({
      job_id: s.job_id,
      hazard_matrix: [
        {
          hazard_type: "electrical",
          initial_risk: 16,
          controls: ["isolate power", "lockout tagout"],
          residual_risk: 4,
        },
      ],
    }),
  },
  "outrider-en-route-notify": {
    schema: z.object({
      worker_id: uuid,
      job_id: uuid.optional(),
      shift_id: uuid.optional(),
      target_status: z.enum(["EN_ROUTE", "DELAYED"]),
      delay_minutes: z.number().int().nonnegative().optional(),
    }),
    generateHappy: (s, faker) => ({
      worker_id: s.worker_user_id,
      job_id: s.job_id,
      target_status: "EN_ROUTE",
      current_lat: Number(faker.location.latitude()),
      current_lng: Number(faker.location.longitude()),
    }),
  },
  "create-terminal-intent": {
    schema: z.object({
      orgId: uuid,
      amountCents: z.number().int().positive(),
    }),
    generateHappy: (s, faker) => ({
      orgId: s.workspace_id,
      amountCents: faker.number.int({ min: 1000, max: 20000 }),
      currency: "aud",
      invoiceId: s.invoice_id,
    }),
  },
  "dispatch-invoices": {
    schema: z.object({
      orgId: uuid,
      invoiceIds: z.array(uuid).min(1),
    }),
    generateHappy: (s) => ({
      orgId: s.workspace_id,
      invoiceIds: [s.invoice_id],
    }),
  },
  "receipt-ocr": {
    schema: z.object({
      organization_id: uuid,
      image_base64: nonEmpty,
      mime_type: z.string().optional(),
    }),
    generateHappy: (s) => ({
      organization_id: s.workspace_id,
      image_base64: "aGVsbG8=",
      mime_type: "image/jpeg",
      job_id: s.job_id,
      worker_id: s.worker_user_id,
    }),
  },
  "semantic-voice-router": {
    schema: z.object({
      debrief_id: uuid,
      organization_id: uuid,
      audio_storage_path: nonEmpty,
    }),
    generateHappy: (s, faker) => ({
      debrief_id: faker.string.uuid(),
      organization_id: s.workspace_id,
      audio_storage_path: "test/audio/mock.m4a",
      sector: "care",
    }),
  },
  "vision-hazard-analyzer": {
    schema: z.object({
      scan_id: uuid,
      organization_id: uuid,
      frame_storage_paths: z.array(nonEmpty).min(1),
    }),
    generateHappy: (s, faker) => ({
      scan_id: faker.string.uuid(),
      organization_id: s.workspace_id,
      job_id: s.job_id,
      frame_storage_paths: ["mock/frame-1.jpg"],
    }),
  },
  "run-automations": { schema: z.object({}), generateHappy: () => ({}) },
  "catalog-nightly-sync": { schema: z.object({}), generateHappy: () => ({}) },
  "process-outbound": { schema: z.object({}), generateHappy: () => ({}) },
  "process-mail": { schema: z.object({}), generateHappy: () => ({}) },
  "trigger-daily-emails": { schema: z.object({}), generateHappy: () => ({}) },
  "asset-service-reminder": { schema: z.object({}), generateHappy: () => ({}) },
  "process-integration-sync-queue": { schema: z.object({}), generateHappy: () => ({}) },
  "process-webhook-queue": { schema: z.object({}), generateHappy: () => ({}) },
  "sync-engine": { schema: z.object({}), generateHappy: () => ({}) },
  "sync-polar-status": { schema: z.object({}), generateHappy: () => ({}) },
  "ingest-telemetry": {
    schema: z.object({
      identity: z.object({
        organization_id: uuid,
        user_id: uuid,
        email: z.string().email().optional(),
      }),
      environment: z.object({ platform: nonEmpty }),
    }),
    generateHappy: (s) => ({
      identity: {
        organization_id: s.workspace_id,
        user_id: s.worker_user_id,
        email: "test@example.com",
      },
      environment: { platform: "web" },
      telemetry: { network_type: "wifi" },
      context: { current_route: "/dashboard" },
    }),
  },
};

export function getCrucibleTarget(name) {
  const explicit = CrucibleRegistry[name];
  if (explicit) return explicit;
  return {
    schema: GenericSchema,
    generateHappy: (seeds, faker) => ({
      workspace_id: seeds.workspace_id,
      organization_id: seeds.workspace_id,
      org_id: seeds.workspace_id,
      user_id: seeds.worker_user_id,
      worker_id: seeds.worker_user_id,
      client_id: seeds.client_id,
      participant_id: seeds.participant_id,
      job_id: seeds.job_id,
      invoice_id: seeds.invoice_id,
      shift_id: seeds.shift_id,
      flow_id: faker.string.uuid(),
      payload: { source: "aegis-crucible" },
      event_type: "test.event",
      trigger_event: "JOB_COMPLETED",
      context_id: seeds.job_id,
      timestamp: new Date().toISOString(),
    }),
    isPublicWebhook: publicWebhookNames.has(name),
  };
}

