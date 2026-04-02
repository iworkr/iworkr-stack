/**
 * @module scripts/crucible/types.ts
 * @status STABLE
 * @lastReview 2026-03-28
 */

export interface SeedContext {
  workspace_id: string;
  admin_user_id: string;
  worker_user_id: string;
  client_id: string;
  participant_id: string;
  job_id: string;
  invoice_id: string;
  care_blueprint_id: string;
  shift_id: string;
}

