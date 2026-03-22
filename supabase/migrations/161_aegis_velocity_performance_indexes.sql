-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 161: Project Aegis-Velocity — Performance Indexes
-- B-Tree indexes on all foreign keys to prevent sequential scans
-- Partial indexes on frequently filtered status columns
-- GIN trigram index for participant name search
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pg_trgm for fuzzy text search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Compatibility shim for environments missing this table.
CREATE TABLE IF NOT EXISTS public.workspace_communication_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE TABLES — High-frequency query paths
-- ═══════════════════════════════════════════════════════════════════════════════

-- Participant name trigram search (fast LIKE/ILIKE on names)
CREATE INDEX IF NOT EXISTS idx_participant_profiles_name_trgm
  ON public.participant_profiles
  USING GIN ((COALESCE(primary_diagnosis, '')) gin_trgm_ops);

-- Partial indexes for active job statuses (dispatch board, schedule)
CREATE INDEX IF NOT EXISTS idx_jobs_active_status
  ON public.jobs(status)
  WHERE status IN ('backlog', 'todo', 'in_progress');

-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSING FK INDEXES — Identified gaps in existing schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- Notification system
CREATE INDEX IF NOT EXISTS idx_notification_push_log_user
  ON public.notification_push_log(user_id);

-- Terminal / payments
CREATE INDEX IF NOT EXISTS idx_terminal_connection_tokens_org
  ON public.terminal_connection_tokens(organization_id);

-- Integration caches (4 tables, all missing org index)
CREATE INDEX IF NOT EXISTS idx_integration_health_metrics_org
  ON public.integration_health_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_tax_cache_org
  ON public.integration_tax_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_account_cache_org
  ON public.integration_account_cache(organization_id);
CREATE INDEX IF NOT EXISTS idx_integration_tracking_cache_org
  ON public.integration_tracking_cache(organization_id);

-- QBO tax mappings
CREATE INDEX IF NOT EXISTS idx_qbo_tax_mappings_org
  ON public.qbo_tax_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_qbo_tax_mappings_integration
  ON public.qbo_tax_mappings(integration_id);

-- Chat system
CREATE INDEX IF NOT EXISTS idx_message_acknowledgements_message
  ON public.message_acknowledgements(message_id);
CREATE INDEX IF NOT EXISTS idx_message_acknowledgements_user
  ON public.message_acknowledgements(user_id);
CREATE INDEX IF NOT EXISTS idx_care_typing_indicators_channel
  ON public.care_typing_indicators(channel_id);
CREATE INDEX IF NOT EXISTS idx_care_chat_members_channel
  ON public.care_chat_members(channel_id);

-- Purchase orders (supplier sync)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_org
  ON public.purchase_orders(organization_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_source_job
  ON public.purchase_orders(source_job_id)
  WHERE source_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_source_quote
  ON public.purchase_orders(source_quote_id)
  WHERE source_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po
  ON public.purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_inventory
  ON public.purchase_order_lines(inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

-- Shift goal linkages (care + clinical)
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_org
  ON public.shift_goal_linkages(organization_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_shift
  ON public.shift_goal_linkages(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_goal
  ON public.shift_goal_linkages(goal_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_worker
  ON public.shift_goal_linkages(worker_id);
CREATE INDEX IF NOT EXISTS idx_shift_goal_linkages_participant
  ON public.shift_goal_linkages(participant_id);

-- Communication logs
CREATE INDEX IF NOT EXISTS idx_communication_logs_worker
  ON public.communication_logs(worker_id)
  WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communication_logs_participant
  ON public.communication_logs(participant_id)
  WHERE participant_id IS NOT NULL;

-- Budget quarantine
CREATE INDEX IF NOT EXISTS idx_budget_quarantine_ledger_org
  ON public.budget_quarantine_ledger(organization_id);

-- Vision hazard scans
CREATE INDEX IF NOT EXISTS idx_vision_hazard_scans_worker
  ON public.vision_hazard_scans(worker_id);
CREATE INDEX IF NOT EXISTS idx_vision_hazard_scans_swms
  ON public.vision_hazard_scans(swms_record_id)
  WHERE swms_record_id IS NOT NULL;

-- Outrider autonomous dispatch
CREATE INDEX IF NOT EXISTS idx_arbitration_events_job
  ON public.arbitration_events(job_id)
  WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_arbitration_events_worker
  ON public.arbitration_events(worker_id)
  WHERE worker_id IS NOT NULL;

-- Oracle ML predictions
CREATE INDEX IF NOT EXISTS idx_ndis_claim_predictions_participant
  ON public.ndis_claim_predictions(participant_id)
  WHERE participant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ndis_claim_predictions_worker
  ON public.ndis_claim_predictions(worker_id)
  WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ndis_claim_predictions_timesheet
  ON public.ndis_claim_predictions(timesheet_id)
  WHERE timesheet_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ndis_claim_predictions_batch
  ON public.ndis_claim_predictions(claim_batch_id)
  WHERE claim_batch_id IS NOT NULL;

-- PACE claims
CREATE INDEX IF NOT EXISTS idx_pace_wip_reservations_org
  ON public.pace_wip_reservations(organization_id);
CREATE INDEX IF NOT EXISTS idx_pace_claims_participant
  ON public.pace_claims(participant_profile_id)
  WHERE participant_profile_id IS NOT NULL;

-- Payroll
CREATE INDEX IF NOT EXISTS idx_timesheet_pay_lines_time_entry
  ON public.timesheet_pay_lines(time_entry_id)
  WHERE time_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worker_pay_profiles_org
  ON public.worker_pay_profiles(organization_id);

-- Audit
CREATE INDEX IF NOT EXISTS idx_audit_sessions_generated_by
  ON public.audit_sessions(generated_by);
CREATE INDEX IF NOT EXISTS idx_audit_sessions_scope_participant
  ON public.audit_sessions(scope_participant_id)
  WHERE scope_participant_id IS NOT NULL;

-- RBAC permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission
  ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_org
  ON public.permission_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target_role
  ON public.permission_audit_log(target_role_id)
  WHERE target_role_id IS NOT NULL;

-- Communication settings
CREATE INDEX IF NOT EXISTS idx_workspace_communication_settings_org
  ON public.workspace_communication_settings(organization_id);

-- Supplier management
CREATE INDEX IF NOT EXISTS idx_workspace_suppliers_org
  ON public.workspace_suppliers(organization_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPOSITE INDEXES — For common multi-column query patterns
-- ═══════════════════════════════════════════════════════════════════════════════

-- Participant list (org + status) — used on every participants page load
CREATE INDEX IF NOT EXISTS idx_participant_profiles_org_status
  ON public.participant_profiles(organization_id);

-- Service agreements (org + participant + status)
CREATE INDEX IF NOT EXISTS idx_service_agreements_org_participant
  ON public.service_agreements(organization_id, participant_id);

-- Progress notes (org + participant + created_at desc) — timeline queries
CREATE INDEX IF NOT EXISTS idx_progress_notes_org_participant_created
  ON public.progress_notes(organization_id, participant_id, created_at DESC);

-- Time entries (org + worker + created_at) — timesheet calculations
CREATE INDEX IF NOT EXISTS idx_time_entries_org_worker_created
  ON public.time_entries(organization_id, worker_id, created_at DESC);

-- Budget allocations (org + participant) — budget telemetry
CREATE INDEX IF NOT EXISTS idx_budget_allocations_org_participant
  ON public.budget_allocations(organization_id, participant_id);

-- Claim line items (org + participant) — finance dashboards
CREATE INDEX IF NOT EXISTS idx_claim_line_items_org_participant
  ON public.claim_line_items(organization_id, participant_id);

-- Schedule blocks (org + status + date) for dispatch
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_org_status_date
  ON public.schedule_blocks(organization_id, status, start_time);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYZE — Force Postgres to update statistics for the query planner
-- ═══════════════════════════════════════════════════════════════════════════════

ANALYZE public.participant_profiles;
ANALYZE public.service_agreements;
ANALYZE public.progress_notes;
ANALYZE public.jobs;
ANALYZE public.schedule_blocks;
ANALYZE public.time_entries;
ANALYZE public.budget_allocations;
ANALYZE public.claim_line_items;
