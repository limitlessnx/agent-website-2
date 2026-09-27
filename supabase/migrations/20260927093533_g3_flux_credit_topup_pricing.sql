alter table public.checkout_sessions
  drop constraint if exists checkout_sessions_billing_type_check;

alter table public.checkout_sessions
  add constraint checkout_sessions_billing_type_check
  check (billing_type = any (array['setup'::text,'subscription'::text,'top_up'::text]));

create unique index if not exists flux_credit_ledger_checkout_topup_unique
  on public.flux_credit_ledger ((metadata->>'checkout_session_id'))
  where transaction_type='top_up'
    and metadata ? 'checkout_session_id';

create or replace function public.apply_flux_credit_topup_from_checkout(target_checkout_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  session_row public.checkout_sessions%rowtype;
  wallet public.flux_credit_wallets;
  credits integer;
  existing_ledger public.flux_credit_ledger%rowtype;
  subscription_status text;
  grace_end timestamptz;
  may_activate boolean:=false;
begin
  select * into session_row
  from public.checkout_sessions
  where id=target_checkout_session_id
  for update;

  if session_row.id is null then
    raise exception 'Checkout session not found';
  end if;
  if session_row.billing_type<>'top_up' then
    raise exception 'Checkout session is not a Flux Credit top-up';
  end if;
  if session_row.status<>'successful' then
    raise exception 'Top-up checkout is not verified as successful';
  end if;
  if session_row.organization_id is null then
    raise exception 'Top-up checkout is not linked to an organization';
  end if;
  if session_row.currency<>'USD' then
    raise exception 'Flux Credit top-ups must be settled in USD';
  end if;
  if session_row.amount<10 then
    raise exception 'Minimum Flux Credit top-up is $10';
  end if;

  credits:=round(session_row.amount*100)::integer;
  if credits<1000 then
    raise exception 'Minimum Flux Credit top-up is 1,000 credits';
  end if;

  select * into existing_ledger
  from public.flux_credit_ledger
  where transaction_type='top_up'
    and metadata->>'checkout_session_id'=session_row.id::text
  limit 1;

  if existing_ledger.id is not null then
    select * into wallet
    from public.flux_credit_wallets
    where organization_id=session_row.organization_id;

    return jsonb_build_object(
      'applied',false,
      'duplicate',true,
      'credits',existing_ledger.credit_delta,
      'balance',wallet.balance,
      'organizationId',session_row.organization_id,
      'checkoutSessionId',session_row.id
    );
  end if;

  select * into wallet
  from public.flux_credit_wallets
  where organization_id=session_row.organization_id
  for update;

  if wallet.organization_id is null then
    raise exception 'Flux Credit wallet not found';
  end if;
  if wallet.trial_ends_at is not null or wallet.trial_credit_limit is not null then
    raise exception 'Top-ups are not available during the Basic free trial';
  end if;

  select s.status,s.grace_period_end
  into subscription_status,grace_end
  from public.organization_subscriptions s
  where s.organization_id=session_row.organization_id
  order by s.updated_at desc
  limit 1;

  may_activate:=
    subscription_status='active'
    or subscription_status='past_due'
    or (subscription_status='grace_period' and (grace_end is null or grace_end>now()));

  update public.flux_credit_wallets
  set balance=balance+credits,
      top_up_balance=top_up_balance+credits,
      status=case
        when status='paused' and may_activate then 'active'
        else status
      end,
      updated_at=now()
  where organization_id=session_row.organization_id
  returning * into wallet;

  insert into public.flux_credit_ledger(
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
    metadata,
    reason,
    created_by
  ) values(
    session_row.organization_id,
    session_row.organization_id,
    'top_up',
    'flux_credit_top_up',
    credits,
    wallet.balance,
    'customer_checkout',
    session_row.provider,
    0,
    credits,
    '{}'::jsonb,
    jsonb_build_object(
      'checkout_session_id',session_row.id,
      'tx_ref',session_row.tx_ref,
      'usd_amount',session_row.amount,
      'credit_rate_usd',0.01,
      'credits_per_usd',100
    ),
    format('Customer purchased %s Flux Credits for $%s',credits,session_row.amount),
    'customer_checkout'
  );

  update public.checkout_sessions
  set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'topup_credits',credits,
        'topup_applied_at',now(),
        'credit_rate_usd',0.01,
        'credits_per_usd',100
      ),
      updated_at=now()
  where id=session_row.id;

  return jsonb_build_object(
    'applied',true,
    'duplicate',false,
    'credits',credits,
    'balance',wallet.balance,
    'organizationId',session_row.organization_id,
    'checkoutSessionId',session_row.id
  );
end;
$$;

revoke all on function public.apply_flux_credit_topup_from_checkout(uuid)
from public,anon,authenticated;
grant execute on function public.apply_flux_credit_topup_from_checkout(uuid)
to service_role;
