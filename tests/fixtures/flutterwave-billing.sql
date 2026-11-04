    create role anon; create role authenticated; create role service_role;
    create table public.billing_plans(id uuid primary key,currency text,recurring_fee numeric,metadata jsonb);
    create table public.organization_subscriptions(
      id uuid primary key,organization_id uuid,plan_id uuid,provider text,provider_subscription_id text,
      status text,current_period_start timestamptz,current_period_end timestamptz,grace_period_end timestamptz,
      metadata jsonb,updated_at timestamptz);
    create table public.payment_webhook_events(id uuid primary key default gen_random_uuid(),provider text,
      external_event_id text,event_type text,signature_valid boolean,payload jsonb,processed_at timestamptz,
      processing_error text,created_at timestamptz default now(),unique(provider,external_event_id));
    create table public.test_wallet(subscription_id uuid primary key,period_end timestamptz,status text);
    create function public.sync_flux_credit_wallet_from_subscription(target_subscription_id uuid)
      returns void language plpgsql set search_path=public as $$ begin
      if current_setting('test.fail_wallet',true)='yes' then raise exception 'wallet unavailable'; end if;
      insert into test_wallet select id,current_period_end,status from organization_subscriptions where id=target_subscription_id
        on conflict(subscription_id) do update set period_end=excluded.period_end,status=excluded.status;
    end; $$;
    insert into billing_plans values('20000000-0000-0000-0000-000000000001','NGN',100,'{}');
    insert into organization_subscriptions values('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','flutterwave','provider-1',
      'active','2028-01-01T12:34:56Z','2028-01-31T12:34:56Z',null,
      '{"provider_customer_email":"client@example.com","billing_currency":"NGN","keep":"yes"}',now());

