-- ============================================================================
-- @migration EquinoxFixLeaveImpactRevenueJoin
-- @status COMPLETE
-- @description Fix Equinox calculate_leave_impact RPC to use correct ledger FK
-- @tables (none — function fix only)
-- @lastAudit 2026-03-22
-- ============================================================================
-- Fix Project Equinox impact RPC to use correct ledger FK.
create or replace function public.calculate_leave_impact(
  p_worker_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_impacted_shifts integer := 0;
  v_revenue_at_risk numeric(12,2) := 0;
  v_impacted_participants integer := 0;
  v_master_roster_impacts integer := 0;
begin
  select count(*)
  into v_impacted_shifts
  from public.schedule_blocks sb
  where sb.technician_id = p_worker_id
    and sb.status in ('scheduled', 'en_route', 'in_progress', 'on_site')
    and sb.start_time <= p_end_date
    and sb.end_time >= p_start_date;

  select coalesce(sum(sfl.projected_revenue), 0)
  into v_revenue_at_risk
  from public.schedule_blocks sb
  join public.shift_financial_ledgers sfl on sfl.schedule_block_id = sb.id
  where sb.technician_id = p_worker_id
    and sb.start_time <= p_end_date
    and sb.end_time >= p_start_date;

  select count(distinct sb.participant_id)
  into v_impacted_participants
  from public.schedule_blocks sb
  where sb.technician_id = p_worker_id
    and sb.participant_id is not null
    and sb.start_time <= p_end_date
    and sb.end_time >= p_start_date;

  select count(*)
  into v_master_roster_impacts
  from public.template_shifts ts
  where ts.primary_worker_id = p_worker_id;

  return jsonb_build_object(
    'impacted_shift_count', v_impacted_shifts,
    'revenue_at_risk', v_revenue_at_risk,
    'unique_participants_affected', v_impacted_participants,
    'master_roster_impacts', v_master_roster_impacts
  );
end;
$$;

