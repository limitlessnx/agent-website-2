create or replace function public.sync_flux_credit_wallet_from_subscription(target_subscription_id uuid)
returns public.flux_credit_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.organization_subscriptions%rowtype;
  plan public.billing_plans%rowtype;
  v_plan_code text;
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

  v_plan_code := coalesce(nullif(sub.metadata->>'plan_code',''), nullif(plan.metadata->>'plan_code',''), plan.slug, 'basic');
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
    v_plan_code,
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

  update public.flux_credit_wallets fw
  set
    plan_code = case v_plan_code
      when 'starter' then 'plus'
      when 'business-plus' then 'business_plus'
      when 'business_plus' then 'business_plus'
      when 'plus' then 'plus'
      when 'business' then 'business'
      else 'basic'
    end,
    current_period_start = coalesce(sub.current_period_start,fw.current_period_start),
    current_period_end = sub.current_period_end,
    status = desired_status,
    metadata = coalesce(fw.metadata,'{}'::jsonb) || jsonb_build_object(
      'subscription_id',sub.id,
      'subscription_status',sub.status,
      'provider',sub.provider,
      'grace_period_end',sub.grace_period_end
    ),
    updated_at = now()
  where fw.organization_id=sub.organization_id
  returning fw.* into wallet;

  return wallet;
end;
$$;

revoke all on function public.sync_flux_credit_wallet_from_subscription(uuid) from public,anon,authenticated;
grant execute on function public.sync_flux_credit_wallet_from_subscription(uuid) to service_role;
