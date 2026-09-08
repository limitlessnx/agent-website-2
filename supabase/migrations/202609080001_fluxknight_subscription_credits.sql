create table if not exists public.flux_credit_wallets (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_code text not null default 'basic' check (plan_code in ('basic','plus','business','business_plus')),
  monthly_allowance integer not null default 2500 check (monthly_allowance >= 0),
  balance integer not null default 0 check (balance >= 0),
  bonus_balance integer not null default 0 check (bonus_balance >= 0),
  top_up_balance integer not null default 0 check (top_up_balance >= 0),
  trial_credit_limit integer check (trial_credit_limit is null or trial_credit_limit >= 0),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  status text not null default 'active' check (status in ('trialing','active','paused','suspended','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flux_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  wallet_organization_id uuid not null references public.flux_credit_wallets(organization_id) on delete restrict,
  transaction_type text not null check (transaction_type in ('monthly_allowance','trial_grant','usage','bonus','top_up','adjustment','refund','expiry')),
  action_key text not null default 'manual',
  credit_delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  source text,
  provider text,
  provider_cost_cents numeric(18,4) not null default 0 check (provider_cost_cents >= 0),
  customer_value_cents numeric(18,4) not null default 0 check (customer_value_cents >= 0),
  provider_usage jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.flux_feature_gate_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_code text not null,
  feature_key text not null,
  required_plan_code text not null,
  allowed boolean not null default false,
  actor_id uuid,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists flux_credit_wallets_organization_idx on public.flux_credit_wallets(organization_id);
create index if not exists flux_credit_ledger_org_created_idx on public.flux_credit_ledger(organization_id, created_at desc);
create index if not exists flux_credit_ledger_action_idx on public.flux_credit_ledger(action_key, created_at desc);
create index if not exists flux_feature_gate_events_org_created_idx on public.flux_feature_gate_events(organization_id, created_at desc);

alter table public.flux_credit_wallets enable row level security;
alter table public.flux_credit_ledger enable row level security;
alter table public.flux_feature_gate_events enable row level security;

revoke all on public.flux_credit_wallets from anon, authenticated;
revoke all on public.flux_credit_ledger from anon, authenticated;
revoke all on public.flux_feature_gate_events from anon, authenticated;

create or replace function public.resolve_flux_monthly_allowance(target_plan_code text, configured_credits integer default null)
returns integer
language sql
immutable
as $$
  select case target_plan_code
    when 'plus' then 5000
    when 'business' then 12000
    when 'business_plus' then greatest(coalesce(configured_credits, 25000), 25000)
    else 2500
  end;
$$;

create or replace function public.ensure_flux_credit_wallet(
  target_organization_id uuid,
  target_plan_code text default 'basic',
  target_monthly_allowance integer default 2500,
  target_trial_credit_limit integer default null,
  target_trial_ends_at timestamptz default null,
  target_current_period_end timestamptz default null
)
returns public.flux_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_wallet public.flux_credit_wallets;
  normalized_plan text;
  allowance integer;
  is_trial boolean;
begin
  normalized_plan := case target_plan_code
    when 'plus' then 'plus'
    when 'starter' then 'plus'
    when 'business' then 'business'
    when 'business_plus' then 'business_plus'
    when 'business-plus' then 'business_plus'
    else 'basic'
  end;
  allowance := resolve_flux_monthly_allowance(normalized_plan, target_monthly_allowance);
  is_trial := target_trial_credit_limit is not null or target_trial_ends_at is not null;
  if is_trial then
    allowance := least(allowance, coalesce(target_trial_credit_limit, 500));
  end if;

  select * into existing_wallet from public.flux_credit_wallets where organization_id = target_organization_id for update;

  if existing_wallet.organization_id is null then
    insert into public.flux_credit_wallets (
      organization_id,
      plan_code,
      monthly_allowance,
      balance,
      trial_credit_limit,
      trial_ends_at,
      current_period_end,
      status
    ) values (
      target_organization_id,
      normalized_plan,
      allowance,
      allowance,
      target_trial_credit_limit,
      target_trial_ends_at,
      target_current_period_end,
      case when is_trial then 'trialing' else 'active' end
    ) returning * into existing_wallet;

    insert into public.flux_credit_ledger (
      organization_id,
      wallet_organization_id,
      transaction_type,
      action_key,
      credit_delta,
      balance_after,
      source,
      customer_value_cents,
      reason
    ) values (
      target_organization_id,
      target_organization_id,
      case when is_trial then 'trial_grant' else 'monthly_allowance' end,
      'cycle_grant',
      allowance,
      allowance,
      'system',
      allowance,
      case when is_trial then 'Basic trial credit grant' else 'Monthly Flux Credit allowance' end
    );
  else
    update public.flux_credit_wallets
    set plan_code = normalized_plan,
        monthly_allowance = allowance,
        trial_credit_limit = target_trial_credit_limit,
        trial_ends_at = target_trial_ends_at,
        current_period_end = target_current_period_end,
        status = case
          when status in ('suspended','cancelled') then status
          when balance <= 0 then 'paused'
          when is_trial then 'trialing'
          else 'active'
        end,
        updated_at = now()
    where organization_id = target_organization_id
    returning * into existing_wallet;
  end if;

  return existing_wallet;
end;
$$;

create or replace function public.record_flux_credit_usage(
  target_organization_id uuid,
  target_action_key text,
  target_credit_amount integer,
  target_source text default 'app',
  target_provider text default null,
  target_provider_cost_cents numeric default 0,
  target_provider_usage jsonb default '{}'::jsonb,
  target_metadata jsonb default '{}'::jsonb
)
returns public.flux_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.flux_credit_wallets;
  next_balance integer;
begin
  if target_credit_amount <= 0 then
    raise exception 'target_credit_amount must be positive';
  end if;

  select * into wallet from public.flux_credit_wallets where organization_id = target_organization_id for update;
  if wallet.organization_id is null then
    raise exception 'Flux credit wallet not found for organization %', target_organization_id;
  end if;
  if wallet.status in ('paused','suspended','cancelled') or wallet.balance < target_credit_amount then
    update public.flux_credit_wallets set status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Flux Credits exhausted. Chargeable AI must hand off to a human operator.';
  end if;

  next_balance := wallet.balance - target_credit_amount;
  update public.flux_credit_wallets
  set balance = next_balance,
      status = case when next_balance <= 0 then 'paused' else wallet.status end,
      updated_at = now()
  where organization_id = target_organization_id
  returning * into wallet;

  insert into public.flux_credit_ledger (
    organization_id,
    wallet_organization_id,
    transaction_type,
    action_key,
    credit_delta,
    balance_after,
    source,
    provider,
    provider_cost_cents,
    customer_value_cents,
    provider_usage,
    metadata
  ) values (
    target_organization_id,
    target_organization_id,
    'usage',
    target_action_key,
    -target_credit_amount,
    wallet.balance,
    target_source,
    target_provider,
    coalesce(target_provider_cost_cents, 0),
    target_credit_amount,
    coalesce(target_provider_usage, '{}'::jsonb),
    coalesce(target_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$$;

create or replace function public.adjust_flux_credit_wallet(
  target_organization_id uuid,
  target_credit_amount integer,
  target_adjustment_type text default 'adjustment',
  target_reason text default null,
  target_admin_email text default null
)
returns public.flux_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.flux_credit_wallets;
  next_balance integer;
  tx_type text;
begin
  if target_credit_amount = 0 then
    raise exception 'target_credit_amount must be non-zero';
  end if;

  select * into wallet from public.flux_credit_wallets where organization_id = target_organization_id for update;
  if wallet.organization_id is null then
    raise exception 'Flux credit wallet not found for organization %', target_organization_id;
  end if;

  next_balance := greatest(wallet.balance + target_credit_amount, 0);
  tx_type := case target_adjustment_type when 'bonus' then 'bonus' when 'top_up' then 'top_up' else 'adjustment' end;

  update public.flux_credit_wallets
  set balance = next_balance,
      bonus_balance = case when tx_type = 'bonus' and target_credit_amount > 0 then bonus_balance + target_credit_amount else bonus_balance end,
      top_up_balance = case when tx_type = 'top_up' and target_credit_amount > 0 and trial_ends_at is null then top_up_balance + target_credit_amount else top_up_balance end,
      status = case when next_balance > 0 and status = 'paused' then 'active' else status end,
      updated_at = now()
  where organization_id = target_organization_id
  returning * into wallet;

  insert into public.flux_credit_ledger (
    organization_id,
    wallet_organization_id,
    transaction_type,
    action_key,
    credit_delta,
    balance_after,
    source,
    customer_value_cents,
    reason,
    created_by
  ) values (
    target_organization_id,
    target_organization_id,
    tx_type,
    'manual_credit_adjustment',
    target_credit_amount,
    wallet.balance,
    'super_admin',
    greatest(target_credit_amount, 0),
    target_reason,
    target_admin_email
  );

  return wallet;
end;
$$;

revoke all on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) from public;
revoke all on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) from public;
revoke all on function public.adjust_flux_credit_wallet(uuid,integer,text,text,text) from public;

grant execute on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) to service_role;
grant execute on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) to service_role;
grant execute on function public.adjust_flux_credit_wallet(uuid,integer,text,text,text) to service_role;

drop trigger if exists flux_credit_wallets_set_updated_at on public.flux_credit_wallets;
create trigger flux_credit_wallets_set_updated_at before update on public.flux_credit_wallets for each row execute function public.set_updated_at();
