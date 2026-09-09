-- Fluxknight Basic free trial v1
-- 14 days OR 250 Flux Credits, whichever is exhausted first.
-- Trial access is intentionally limited at the application/runtime layer to
-- WhatsApp AI and Web AI. No payment method is required to provision it.

create unique index if not exists organization_subscriptions_one_basic_free_trial
  on public.organization_subscriptions (organization_id)
  where metadata ->> 'trial_type' = 'basic_free_trial';

create or replace function public.start_fluxknight_basic_free_trial(
  target_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_plan_id uuid;
  v_subscription public.organization_subscriptions;
  v_wallet public.flux_credit_wallets;
  v_trial_ends_at timestamptz;
begin
  if target_organization_id is null then
    raise exception 'organization_id is required';
  end if;

  if not exists (
    select 1 from public.organizations where id = target_organization_id
  ) then
    raise exception 'Organization does not exist';
  end if;

  -- A paid/current subscription always wins. Never replace it with a trial.
  select *
  into v_subscription
  from public.organization_subscriptions
  where organization_id = target_organization_id
    and status in ('active', 'past_due', 'grace_period')
  order by updated_at desc
  limit 1;

  if v_subscription.id is not null then
    return jsonb_build_object(
      'started', false,
      'reason', 'existing_subscription',
      'subscription_id', v_subscription.id
    );
  end if;

  -- Idempotency: an organization can receive this free trial only once.
  select *
  into v_subscription
  from public.organization_subscriptions
  where organization_id = target_organization_id
    and metadata ->> 'trial_type' = 'basic_free_trial'
  order by created_at asc
  limit 1;

  if v_subscription.id is not null then
    v_wallet := public.ensure_flux_credit_wallet(
      target_organization_id,
      'basic',
      250,
      250,
      v_subscription.trial_ends_at,
      v_subscription.current_period_end
    );

    return jsonb_build_object(
      'started', false,
      'reason', 'trial_already_granted',
      'subscription_id', v_subscription.id,
      'trial_ends_at', v_subscription.trial_ends_at,
      'credit_limit', 250,
      'balance', v_wallet.balance,
      'wallet_status', v_wallet.status
    );
  end if;

  select id
  into v_plan_id
  from public.billing_plans
  where status = 'active'
    and metadata ->> 'plan_code' = 'basic'
  order by case when slug = 'whatsapp-ai-starter' then 0 else 1 end, created_at desc
  limit 1;

  if v_plan_id is null then
    raise exception 'Active Basic billing plan was not found';
  end if;

  v_trial_ends_at := now() + interval '14 days';

  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at,
    metadata
  ) values (
    target_organization_id,
    v_plan_id,
    'trialing',
    now(),
    v_trial_ends_at,
    v_trial_ends_at,
    jsonb_build_object(
      'plan_code', 'basic',
      'free_trial', true,
      'trial_type', 'basic_free_trial',
      'trial_version', 1,
      'trial_days', 14,
      'trial_credit_limit', 250,
      'monthly_credits', 250,
      'allowed_ai_actions', jsonb_build_array('web_ai', 'whatsapp_ai'),
      'payment_method_required', false
    )
  )
  returning * into v_subscription;

  v_wallet := public.ensure_flux_credit_wallet(
    target_organization_id,
    'basic',
    250,
    250,
    v_trial_ends_at,
    v_trial_ends_at
  );

  insert into public.audit_logs (
    organization_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) values (
    target_organization_id,
    'subscription.trial_started',
    'organization_subscription',
    v_subscription.id::text,
    jsonb_build_object(
      'trial_type', 'basic_free_trial',
      'trial_days', 14,
      'credit_limit', 250,
      'trial_ends_at', v_trial_ends_at
    )
  );

  return jsonb_build_object(
    'started', true,
    'subscription_id', v_subscription.id,
    'trial_ends_at', v_trial_ends_at,
    'credit_limit', 250,
    'balance', v_wallet.balance,
    'wallet_status', v_wallet.status
  );
end;
$function$;

create or replace function public.provision_trial_client_organization(
  p_user_id uuid,
  p_organization_name text,
  p_organization_slug text default null,
  p_template_slug text default null,
  p_agent_family_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = 'public', 'auth'
as $function$
declare
  v_provisioned jsonb;
  v_trial jsonb;
  v_org_id uuid;
begin
  v_provisioned := public.provision_client_organization(
    p_user_id,
    p_organization_name,
    p_organization_slug,
    p_template_slug,
    p_agent_family_name
  );

  v_org_id := (v_provisioned ->> 'organization_id')::uuid;
  v_trial := public.start_fluxknight_basic_free_trial(v_org_id);

  return v_provisioned || jsonb_build_object('trial', v_trial);
end;
$function$;
