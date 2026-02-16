-- ============================================================
-- Migration 005: Subscriptions
-- Local cache of Polar.sh billing state for instant feature gating
-- ============================================================

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations on delete cascade,
  polar_subscription_id  text unique not null,
  polar_product_id       text,
  plan_key               text not null,
  status                 public.subscription_status not null default 'incomplete',
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean default false,
  canceled_at            timestamptz,
  metadata               jsonb default '{}',
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- Only one active subscription per org
create unique index idx_subscriptions_org_active on public.subscriptions (organization_id)
  where status in ('active', 'past_due', 'trialing');
create index idx_subscriptions_polar on public.subscriptions (polar_subscription_id);
create index idx_subscriptions_status on public.subscriptions (status);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_updated_at();
