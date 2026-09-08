alter table public.organization_subscriptions add column if not exists trial_ends_at timestamptz;

update public.billing_plans
set name = 'Basic',
    metadata = coalesce(metadata, '{}'::jsonb) || '{"plan_code":"basic","monthly_credits":2500,"public_catalog":true}'::jsonb,
    updated_at = now()
where slug = 'whatsapp-ai-starter';

update public.billing_plans
set name = 'Plus',
    metadata = coalesce(metadata, '{}'::jsonb) || '{"plan_code":"plus","monthly_credits":5000,"public_catalog":true,"legacy_name":"Starter"}'::jsonb,
    updated_at = now()
where slug in ('ai-call-receptionist', 'starter', 'plus');

update public.billing_plans
set name = 'Business',
    metadata = coalesce(metadata, '{}'::jsonb) || '{"plan_code":"business","monthly_credits":12000,"public_catalog":true}'::jsonb,
    updated_at = now()
where slug = 'ai-front-desk-suite';

update public.billing_plans
set name = 'Business+',
    metadata = coalesce(metadata, '{}'::jsonb) || '{"plan_code":"business_plus","monthly_credits":25000,"configurable_monthly_credits":true,"public_catalog":true}'::jsonb,
    updated_at = now()
where slug = 'custom-ai-operations';

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
  trial_expired boolean;
  should_reset_allowance boolean;
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
  trial_expired := target_trial_ends_at is not null and target_trial_ends_at <= now();
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
      case when trial_expired then 0 else allowance end,
      target_trial_credit_limit,
      target_trial_ends_at,
      target_current_period_end,
      case when trial_expired then 'paused' when is_trial then 'trialing' else 'active' end
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
      existing_wallet.balance,
      existing_wallet.balance,
      'system',
      existing_wallet.balance,
      case when is_trial then 'Basic trial credit grant' else 'Monthly Flux Credit allowance' end
    );
  else
    should_reset_allowance :=
      (existing_wallet.status = 'trialing' and not is_trial)
      or existing_wallet.plan_code <> normalized_plan
      or (not is_trial and existing_wallet.current_period_end is distinct from target_current_period_end and target_current_period_end is not null);

    update public.flux_credit_wallets
    set plan_code = normalized_plan,
        monthly_allowance = allowance,
        balance = case
          when trial_expired then 0
          when should_reset_allowance then allowance
          else balance
        end,
        trial_credit_limit = target_trial_credit_limit,
        trial_ends_at = target_trial_ends_at,
        current_period_end = target_current_period_end,
        status = case
          when status in ('suspended','cancelled') then status
          when trial_expired then 'paused'
          when (case when should_reset_allowance then allowance else balance end) <= 0 then 'paused'
          when is_trial then 'trialing'
          else 'active'
        end,
        updated_at = now()
    where organization_id = target_organization_id
    returning * into existing_wallet;

    if should_reset_allowance and existing_wallet.balance > 0 then
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
        'monthly_allowance',
        'cycle_grant',
        existing_wallet.balance,
        existing_wallet.balance,
        'system',
        existing_wallet.balance,
        'Monthly Flux Credit allowance reset'
      );
    end if;
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
  if wallet.trial_ends_at is not null and wallet.trial_ends_at <= now() then
    update public.flux_credit_wallets set balance = 0, status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Basic trial expired. Chargeable AI must hand off to a human operator.';
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

  tx_type := case target_adjustment_type when 'bonus' then 'bonus' when 'top_up' then 'top_up' else 'adjustment' end;
  if tx_type = 'top_up' and wallet.trial_ends_at is not null then
    raise exception 'Top-ups are not available during the Basic free trial.';
  end if;

  next_balance := greatest(wallet.balance + target_credit_amount, 0);

  update public.flux_credit_wallets
  set balance = next_balance,
      bonus_balance = case when tx_type = 'bonus' and target_credit_amount > 0 then bonus_balance + target_credit_amount else bonus_balance end,
      top_up_balance = case when tx_type = 'top_up' and target_credit_amount > 0 then top_up_balance + target_credit_amount else top_up_balance end,
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
