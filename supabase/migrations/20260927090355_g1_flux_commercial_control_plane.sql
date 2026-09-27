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
  next_balance integer;
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
    allowance := least(allowance, least(coalesce(target_trial_credit_limit, 250), 250));
  end if;

  select * into existing_wallet
  from public.flux_credit_wallets
  where organization_id = target_organization_id
  for update;

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
      case when is_trial then allowance else null end,
      target_trial_ends_at,
      target_current_period_end,
      case when trial_expired then 'paused' when is_trial then 'trialing' else 'active' end
    )
    returning * into existing_wallet;

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
      or (
        not is_trial
        and existing_wallet.current_period_end is distinct from target_current_period_end
        and target_current_period_end is not null
      );

    next_balance := case
      when trial_expired then 0
      when should_reset_allowance then allowance
      when is_trial then least(existing_wallet.balance, allowance)
      else existing_wallet.balance
    end;

    update public.flux_credit_wallets
    set plan_code = normalized_plan,
        monthly_allowance = allowance,
        balance = next_balance,
        trial_credit_limit = case when is_trial then allowance else null end,
        trial_ends_at = target_trial_ends_at,
        current_period_end = target_current_period_end,
        status = case
          when status in ('suspended','cancelled') then status
          when trial_expired then 'paused'
          when next_balance <= 0 then 'paused'
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

revoke all on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) to service_role;

create or replace function public.sync_flux_credit_wallet_from_subscription(target_subscription_id uuid)
returns public.flux_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.organization_subscriptions%rowtype;
  plan public.billing_plans%rowtype;
  plan_code text;
  configured_credits integer;
  trial_limit integer;
  wallet public.flux_credit_wallets;
  desired_status text;
  grace_expired boolean;
begin
  select * into sub
  from public.organization_subscriptions
  where id = target_subscription_id;

  if sub.id is null then
    raise exception 'Subscription not found';
  end if;

  select * into plan
  from public.billing_plans
  where id = sub.plan_id;

  if plan.id is null then
    raise exception 'Billing plan not found';
  end if;

  plan_code := coalesce(nullif(sub.metadata->>'plan_code',''), nullif(plan.metadata->>'plan_code',''), plan.slug, 'basic');
  configured_credits := coalesce(
    nullif(sub.metadata->>'monthly_credits','')::integer,
    nullif(plan.metadata->>'monthly_credits','')::integer
  );
  trial_limit := case
    when sub.status='trialing' then least(
      250,
      greatest(0,coalesce(nullif(sub.metadata->>'trial_credit_limit','')::integer,250))
    )
    else null
  end;

  wallet := public.ensure_flux_credit_wallet(
    sub.organization_id,
    plan_code,
    configured_credits,
    trial_limit,
    case when sub.status='trialing' then sub.trial_ends_at else null end,
    sub.current_period_end
  );

  grace_expired := sub.status in ('past_due','grace_period')
    and sub.grace_period_end is not null
    and sub.grace_period_end <= now();

  desired_status := case
    when sub.status='cancelled' then 'cancelled'
    when sub.status='suspended' then 'suspended'
    when sub.status='pending' then 'paused'
    when sub.status='trialing' and (sub.trial_ends_at is not null and sub.trial_ends_at <= now()) then 'paused'
    when grace_expired then 'paused'
    when wallet.balance <= 0 then 'paused'
    when sub.status='trialing' then 'trialing'
    else 'active'
  end;

  update public.flux_credit_wallets
  set
    plan_code = case plan_code
      when 'starter' then 'plus'
      when 'business-plus' then 'business_plus'
      when 'business_plus' then 'business_plus'
      when 'plus' then 'plus'
      when 'business' then 'business'
      else 'basic'
    end,
    current_period_start = coalesce(sub.current_period_start,current_period_start),
    current_period_end = sub.current_period_end,
    status = desired_status,
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'subscription_id',sub.id,
      'subscription_status',sub.status,
      'provider',sub.provider,
      'grace_period_end',sub.grace_period_end
    ),
    updated_at = now()
  where organization_id=sub.organization_id
  returning * into wallet;

  return wallet;
end;
$$;

revoke all on function public.sync_flux_credit_wallet_from_subscription(uuid) from public,anon,authenticated;
grant execute on function public.sync_flux_credit_wallet_from_subscription(uuid) to service_role;

create or replace function public.sync_flux_subscription_wallet_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_flux_credit_wallet_from_subscription(new.id);
  return new;
end;
$$;

drop trigger if exists organization_subscriptions_sync_flux_wallet on public.organization_subscriptions;
create trigger organization_subscriptions_sync_flux_wallet
after insert or update of plan_id,status,current_period_start,current_period_end,grace_period_end,trial_ends_at,metadata
on public.organization_subscriptions
for each row execute function public.sync_flux_subscription_wallet_trigger();

create or replace function public.sync_flux_credit_threshold_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  percent_used integer;
  threshold_level integer;
  severity_value text;
  title_value text;
  message_value text;
  event_key_value text;
begin
  if new.monthly_allowance <= 0 then
    percent_used := 0;
  else
    percent_used := least(100,greatest(0,round(((new.monthly_allowance-least(new.balance,new.monthly_allowance))::numeric/new.monthly_allowance)*100)::integer));
  end if;

  threshold_level := case
    when new.status in ('suspended','cancelled') then 100
    when new.status='paused' or percent_used>=100 then 100
    when percent_used>=90 then 90
    when percent_used>=70 then 70
    else null
  end;

  event_key_value := 'billing:'||new.organization_id||':flux_credit_threshold';

  if threshold_level is null then
    update public.dashboard_notifications
    set resolved_at=now(),updated_at=now(),persistent=false,last_seen_at=now()
    where event_key=event_key_value and resolved_at is null;
    return new;
  end if;

  severity_value := case when threshold_level>=100 then 'critical' else 'warning' end;
  title_value := case
    when new.status='suspended' then 'AI usage suspended'
    when new.status='cancelled' then 'Subscription cancelled'
    when threshold_level=100 then 'Flux Credits exhausted'
    when threshold_level=90 then 'Flux Credits nearly exhausted'
    else 'Flux Credit usage warning'
  end;
  message_value := case
    when new.status='suspended' then 'Chargeable AI is suspended for this workspace.'
    when new.status='cancelled' then 'Chargeable AI is unavailable because this subscription is cancelled.'
    when threshold_level=100 then 'Chargeable AI is paused until credits are added, the plan renews, or the subscription is upgraded.'
    when threshold_level=90 then 'At least 90% of this cycle''s included Flux Credits have been used.'
    else 'At least 70% of this cycle''s included Flux Credits have been used.'
  end;

  insert into public.dashboard_notifications(
    event_key,organization_id,audience,category,severity,title,message,
    action_label,action_href,source,persistent,metadata,last_seen_at,resolved_at,updated_at
  ) values(
    event_key_value,new.organization_id,'customer','billing',severity_value,title_value,message_value,
    'Review billing','/portal/billing','flux_credits',threshold_level>=100,
    jsonb_build_object(
      'threshold',threshold_level,
      'percent_used',percent_used,
      'balance',new.balance,
      'monthly_allowance',new.monthly_allowance,
      'wallet_status',new.status,
      'plan_code',new.plan_code
    ),
    now(),null,now()
  )
  on conflict(event_key) do update set
    severity=excluded.severity,
    title=excluded.title,
    message=excluded.message,
    persistent=excluded.persistent,
    metadata=excluded.metadata,
    last_seen_at=excluded.last_seen_at,
    resolved_at=null,
    updated_at=now();

  return new;
end;
$$;

drop trigger if exists flux_credit_wallet_threshold_notification on public.flux_credit_wallets;
create trigger flux_credit_wallet_threshold_notification
after insert or update of balance,monthly_allowance,status,plan_code
on public.flux_credit_wallets
for each row execute function public.sync_flux_credit_threshold_notification();

create or replace function public.get_flux_commercial_snapshot(target_organization_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  result jsonb;
begin
  with subscription as (
    select s.id,s.status,s.provider,s.current_period_start,s.current_period_end,s.grace_period_end,s.trial_ends_at,
           p.id plan_id,p.name plan_name,p.slug plan_slug,p.currency,p.recurring_fee,p.billing_interval,p.metadata plan_metadata,
           s.metadata subscription_metadata
    from public.organization_subscriptions s
    join public.billing_plans p on p.id=s.plan_id
    where s.organization_id=target_organization_id
    order by
      case when s.status in ('pending','trialing','active','past_due','grace_period','suspended') then 0 else 1 end,
      s.updated_at desc
    limit 1
  ),
  wallet as (
    select *
    from public.flux_credit_wallets
    where organization_id=target_organization_id
  ),
  package_assignment as (
    select osp.id assignment_id,osp.status assignment_status,osp.starts_at,osp.ends_at,
           sp.id package_id,sp.name package_name,sp.slug package_slug
    from public.organization_service_packages osp
    join public.service_packages sp on sp.id=osp.service_package_id
    where osp.organization_id=target_organization_id
      and osp.status='active'
      and osp.starts_at<=now()
      and (osp.ends_at is null or osp.ends_at>now())
    order by osp.starts_at desc
    limit 1
  ),
  usage as (
    select
      coalesce(sum(abs(credit_delta)) filter(where transaction_type='usage' and created_at>=date_trunc('month',now())),0)::bigint used_this_month,
      coalesce(sum(provider_cost_cents) filter(where transaction_type='usage' and created_at>=date_trunc('month',now())),0)::numeric provider_cost_cents,
      count(*) filter(where transaction_type='usage' and created_at>=date_trunc('month',now()))::int usage_events
    from public.flux_credit_ledger
    where organization_id=target_organization_id
  ),
  systems as (
    select
      count(*) filter(where status='active')::int active,
      count(*) filter(where status='needs_attention')::int needs_attention
    from public.organization_systems
    where organization_id=target_organization_id
  )
  select jsonb_build_object(
    'organizationId',target_organization_id,
    'subscription',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'status',s.status,'provider',s.provider,
      'currentPeriodStart',s.current_period_start,'currentPeriodEnd',s.current_period_end,
      'gracePeriodEnd',s.grace_period_end,'trialEndsAt',s.trial_ends_at,
      'planId',s.plan_id,'planName',s.plan_name,'planSlug',s.plan_slug,
      'currency',s.currency,'recurringFee',s.recurring_fee,'billingInterval',s.billing_interval,
      'planCode',coalesce(s.subscription_metadata->>'plan_code',s.plan_metadata->>'plan_code')
    ) end,
    'wallet',case when w.organization_id is null then null else jsonb_build_object(
      'planCode',w.plan_code,'monthlyAllowance',w.monthly_allowance,'balance',w.balance,
      'bonusBalance',w.bonus_balance,'topUpBalance',w.top_up_balance,
      'trialCreditLimit',w.trial_credit_limit,'trialEndsAt',w.trial_ends_at,
      'currentPeriodStart',w.current_period_start,'currentPeriodEnd',w.current_period_end,'status',w.status
    ) end,
    'servicePackage',case when p.assignment_id is null then null else jsonb_build_object(
      'assignmentId',p.assignment_id,'status',p.assignment_status,
      'packageId',p.package_id,'packageName',p.package_name,'packageSlug',p.package_slug,
      'startsAt',p.starts_at,'endsAt',p.ends_at
    ) end,
    'usage',jsonb_build_object(
      'usedThisMonth',u.used_this_month,'usageEvents',u.usage_events,'providerCostCents',u.provider_cost_cents
    ),
    'systems',jsonb_build_object('active',sy.active,'needsAttention',sy.needs_attention)
  )
  into result
  from subscription s
  full join wallet w on true
  full join package_assignment p on true
  cross join usage u
  cross join systems sy;

  if result is null then
    result:=jsonb_build_object(
      'organizationId',target_organization_id,
      'subscription',null,'wallet',null,'servicePackage',null,
      'usage',jsonb_build_object('usedThisMonth',0,'usageEvents',0,'providerCostCents',0),
      'systems',jsonb_build_object('active',0,'needsAttention',0)
    );
  end if;

  return result;
end;
$$;

revoke all on function public.get_flux_commercial_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_flux_commercial_snapshot(uuid) to service_role;
