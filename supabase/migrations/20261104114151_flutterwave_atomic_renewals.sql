begin;

alter table public.payment_webhook_events
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz;

-- Unlike the old 24-element metadata array, this ledger never forgets a charge.
create table public.flutterwave_renewal_transactions (
  transaction_id text primary key check (length(btrim(transaction_id)) > 0),
  subscription_id uuid not null references public.organization_subscriptions(id) on delete restrict,
  payment_status text not null check (payment_status in ('successful','failed')),
  paid_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index flutterwave_renewal_transactions_subscription_idx
  on public.flutterwave_renewal_transactions(subscription_id);
alter table public.flutterwave_renewal_transactions enable row level security;
revoke all on public.flutterwave_renewal_transactions from public, anon, authenticated;
grant select, insert, update on public.flutterwave_renewal_transactions to service_role;

create function public.claim_flutterwave_webhook(external_id text, event_type text, event_payload jsonb, claim_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ev public.payment_webhook_events%rowtype;
begin
  if claim_token is null or nullif(btrim(external_id),'') is null then
    raise exception 'Missing webhook claim identity';
  end if;
  insert into public.payment_webhook_events(provider,external_event_id,event_type,signature_valid,payload)
  values ('flutterwave',external_id,event_type,true,event_payload)
  on conflict (provider,external_event_id) do nothing;
  select * into strict ev from public.payment_webhook_events
  where provider='flutterwave' and external_event_id=external_id for update;
  if ev.processed_at is not null then
    return jsonb_build_object('id',ev.id,'state','processed');
  end if;
  if ev.processing_token is not null and ev.processing_started_at > clock_timestamp() - interval '5 minutes' then
    return jsonb_build_object('id',ev.id,'state','busy');
  end if;
  -- Legacy rows without a token are reclaimable too. Replacement tokens fence
  -- old workers out of both renewal application and completion/error writes.
  update public.payment_webhook_events set processing_token=claim_token,
    processing_started_at=clock_timestamp(),processing_error=null where id=ev.id;
  return jsonb_build_object('id',ev.id,'state','claimed');
end;
$$;

create function public.apply_flutterwave_renewal(
  target_subscription_id uuid, expected_provider_subscription_id text,
  target_event_id uuid, claim_token uuid, transaction_id text,
  payment_status text, paid_at timestamptz, payment_amount numeric,
  payment_currency text, customer_email text, provider_reference text
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  sub public.organization_subscriptions%rowtype;
  plan public.billing_plans%rowtype;
  prior public.flutterwave_renewal_transactions%rowtype;
  effective_paid_at timestamptz := paid_at;
  period_start timestamptz;
  period_end timestamptz;
  expected_amount numeric;
begin
  -- Holding this row lock prevents a reclaimer from overtaking a transaction
  -- after its ownership check. Every mutation uses event -> subscription order.
  perform 1 from public.payment_webhook_events where id=target_event_id
    and provider='flutterwave' and processing_token=claim_token and processed_at is null for update;
  if not found then raise exception 'Webhook claim is no longer owned'; end if;
  if nullif(btrim(transaction_id),'') is null or payment_status not in ('successful','failed') or payment_status is null
    or effective_paid_at is null or not isfinite(effective_paid_at) then
    raise exception 'Invalid verified renewal';
  end if;
  select * into strict sub from public.organization_subscriptions where id=target_subscription_id for update;
  if sub.provider is distinct from 'flutterwave' or sub.provider_subscription_id is distinct from expected_provider_subscription_id
    or expected_provider_subscription_id is null then raise exception 'Subscription identity changed'; end if;
  select * into strict plan from public.billing_plans where id=sub.plan_id;
  expected_amount := case when coalesce(sub.metadata->>'billing_currency',plan.currency)='USD'
    then (plan.metadata->'international'->>'recurring_fee')::numeric else plan.recurring_fee end;
  if upper(payment_currency) is distinct from upper(coalesce(sub.metadata->>'billing_currency',plan.currency))
    or payment_amount is distinct from expected_amount or expected_amount is null or expected_amount <= 0
    or lower(btrim(customer_email)) is distinct from lower(btrim(sub.metadata->>'provider_customer_email'))
    or nullif(btrim(customer_email),'') is null then raise exception 'Renewal payment does not match subscription'; end if;

  -- Serialize the global transaction identity, including accidental cross-tenant
  -- reuse. Conflicts fail closed before modifying either tenant.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(transaction_id, 0));
  select * into prior from public.flutterwave_renewal_transactions t where t.transaction_id=apply_flutterwave_renewal.transaction_id;
  if found then
    if prior.subscription_id <> sub.id then raise exception 'Transaction belongs to another subscription'; end if;
    if prior.payment_status='successful' or payment_status='failed' then
      return jsonb_build_object('duplicate',true,'subscriptionId',sub.id);
    end if;
  end if;
  -- Preserve deduplication across rollout, including the initial checkout charge.
  if sub.metadata->>'provider_transaction_id'=transaction_id
    or coalesce(sub.metadata->'processed_flutterwave_transaction_ids','[]'::jsonb) ? transaction_id then
    return jsonb_build_object('duplicate',true,'subscriptionId',sub.id);
  end if;
  if sub.status not in ('active','past_due','grace_period') then
    return jsonb_build_object('ignored',true,'subscriptionId',sub.id);
  end if;
  insert into public.flutterwave_renewal_transactions(transaction_id,subscription_id,payment_status,paid_at)
    values (transaction_id,sub.id,payment_status,effective_paid_at)
    on conflict on constraint flutterwave_renewal_transactions_pkey do update
      set payment_status=excluded.payment_status,paid_at=excluded.paid_at;

  if payment_status='successful' then
    period_start := greatest(coalesce(sub.current_period_end,effective_paid_at),effective_paid_at);
    -- Convert to UTC before calendar arithmetic, independent of DB session TZ.
    period_end := ((period_start at time zone 'UTC') + interval '1 month') at time zone 'UTC';
    update public.organization_subscriptions set status='active',current_period_start=period_start,
      current_period_end=period_end,grace_period_end=null,
      metadata=coalesce(sub.metadata,'{}'::jsonb) || jsonb_build_object(
        'provider_transaction_id',transaction_id,'provider_reference',provider_reference,
        'last_renewal_paid_at',effective_paid_at,'last_renewal_status','successful'),updated_at=now()
      where id=sub.id;
  else
    -- Delayed failures must not revoke a newer successful period or keep
    -- extending grace on each retry. The provider timestamp anchors grace.
    if effective_paid_at <= coalesce((sub.metadata->>'last_renewal_paid_at')::timestamptz,sub.current_period_start,'-infinity'::timestamptz) then
      return jsonb_build_object('ignored',true,'subscriptionId',sub.id);
    end if;
    update public.organization_subscriptions set status='grace_period',
      grace_period_end=case when sub.grace_period_end is null then effective_paid_at + interval '24 hours'
        else least(sub.grace_period_end,effective_paid_at + interval '24 hours') end,
      metadata=coalesce(sub.metadata,'{}'::jsonb) || jsonb_build_object(
        'last_renewal_failed_at',effective_paid_at,'last_renewal_status','failed','last_failed_transaction_id',transaction_id),updated_at=now()
      where id=sub.id;
  end if;
  perform public.sync_flux_credit_wallet_from_subscription(sub.id);
  return jsonb_build_object('renewed',payment_status='successful','pastDue',payment_status='failed','subscriptionId',sub.id);
end;
$$;

create function public.cancel_flutterwave_subscription(target_subscription_id uuid, expected_provider_subscription_id text, target_event_id uuid, claim_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare sub public.organization_subscriptions%rowtype;
begin
  perform 1 from public.payment_webhook_events where id=target_event_id
    and provider='flutterwave' and processing_token=claim_token and processed_at is null for update;
  if not found then raise exception 'Webhook claim is no longer owned'; end if;
  select * into strict sub from public.organization_subscriptions where id=target_subscription_id for update;
  if sub.provider is distinct from 'flutterwave' or sub.provider_subscription_id is distinct from expected_provider_subscription_id
    or expected_provider_subscription_id is null then raise exception 'Subscription identity changed'; end if;
  if sub.status='cancelled' then return jsonb_build_object('duplicate',true); end if;
  if sub.status not in ('active','past_due','grace_period') then raise exception 'Subscription is no longer cancellable'; end if;
  update public.organization_subscriptions set status='cancelled',grace_period_end=null,
    metadata=coalesce(sub.metadata,'{}'::jsonb) || jsonb_build_object('cancelled_at',now(),'cancellation_source','flutterwave'),updated_at=now()
    where id=sub.id;
  perform public.sync_flux_credit_wallet_from_subscription(sub.id);
  return jsonb_build_object('cancelled',true,'subscriptionId',sub.id);
end;
$$;
revoke all on function public.cancel_flutterwave_subscription(uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_flutterwave_subscription(uuid,text,uuid,uuid) to service_role;

revoke all on function public.claim_flutterwave_webhook(text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.claim_flutterwave_webhook(text,text,jsonb,uuid) to service_role;
revoke all on function public.apply_flutterwave_renewal(uuid,text,uuid,uuid,text,text,timestamptz,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_flutterwave_renewal(uuid,text,uuid,uuid,text,text,timestamptz,numeric,text,text,text) to service_role;
commit;
