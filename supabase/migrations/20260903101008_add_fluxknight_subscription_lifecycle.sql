create or replace function public.dispatch_fluxknight_lifecycle_event(p_event_key text, p_event_type text, p_recipient_email text, p_payload jsonb, p_user_id uuid default null::uuid, p_organization_id uuid default null::uuid, p_payment_attempt_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions','vault','net'
as $function$
declare
  v_api_key text;
  v_request_id bigint;
  v_event_id uuid;
  v_existing_status text;
begin
  if p_event_key is null or btrim(p_event_key) = '' then raise exception 'event key is required'; end if;
  if p_event_type not in (
    'fluxknight.user.verified','fluxknight.payment.succeeded','fluxknight.payment.failed','fluxknight.workspace.ready','fluxknight.provisioning.failed','fluxknight.onboarding.incomplete',
    'fluxknight.subscription.renewal_upcoming','fluxknight.subscription.renewal_succeeded','fluxknight.subscription.renewal_failed','fluxknight.subscription.cancellation_scheduled','fluxknight.subscription.cancelled','fluxknight.subscription.grace_period'
  ) then raise exception 'unsupported lifecycle event type: %', p_event_type; end if;
  if p_recipient_email is null or btrim(p_recipient_email) = '' then raise exception 'recipient email is required'; end if;

  insert into public.transactional_email_events(event_key,event_type,user_id,organization_id,payment_attempt_id,recipient_email,payload,status,updated_at)
  values (p_event_key,p_event_type,p_user_id,p_organization_id,p_payment_attempt_id,lower(btrim(p_recipient_email)),coalesce(p_payload,'{}'::jsonb),'pending',now())
  on conflict (event_key) do nothing returning id into v_event_id;

  if v_event_id is null then
    select id,status into v_event_id,v_existing_status from public.transactional_email_events where event_key=p_event_key;
    if v_existing_status in ('sent','pending') then return jsonb_build_object('ok',true,'skipped',true,'reason','duplicate_event_key'); end if;
    update public.transactional_email_events set status='pending',last_error=null,payload=coalesce(p_payload,'{}'::jsonb),recipient_email=lower(btrim(p_recipient_email)),provider_response=null,sent_at=null,updated_at=now() where id=v_event_id;
  end if;

  select decrypted_secret into v_api_key from vault.decrypted_secrets where name='fluxknight_resend_api_key' limit 1;
  if v_api_key is null or btrim(v_api_key)='' then
    update public.transactional_email_events set status='failed',last_error='Fluxknight Resend Vault secret missing',updated_at=now() where id=v_event_id;
    raise exception 'Fluxknight Resend Vault secret missing';
  end if;

  select net.http_post(
    url:='https://api.resend.com/events/send',
    headers:=jsonb_build_object('Authorization','Bearer '||v_api_key,'Content-Type','application/json','User-Agent','fluxknight-supabase-lifecycle/1.0'),
    body:=jsonb_build_object('event',p_event_type,'email',lower(btrim(p_recipient_email)),'payload',coalesce(p_payload,'{}'::jsonb))
  ) into v_request_id;

  update public.transactional_email_events set status='pending',provider_response=jsonb_build_object('pg_net_request_id',v_request_id),last_error=null,updated_at=now() where id=v_event_id;
  return jsonb_build_object('ok',true,'skipped',false,'request_id',v_request_id);
exception when others then
  if v_event_id is not null then update public.transactional_email_events set status='failed',last_error=sqlerrm,updated_at=now() where id=v_event_id; end if;
  raise;
end;
$function$;

create or replace function public.send_fluxknight_subscription_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  r record;
  v_email text;
  v_first_name text;
  v_count integer := 0;
  v_days integer;
  v_event_key text;
begin
  for r in
    select s.id,s.organization_id,s.current_period_end,b.name as plan_name,b.recurring_fee,b.currency,m.user_id
    from public.organization_subscriptions s
    join public.billing_plans b on b.id=s.plan_id
    join lateral (
      select om.user_id from public.organization_memberships om
      where om.organization_id=s.organization_id and om.status='active'
      order by om.created_at asc limit 1
    ) m on true
    where s.status in ('active','trialing') and s.current_period_end is not null
      and s.current_period_end > now()
      and s.current_period_end <= now() + interval '8 days'
  loop
    v_days := case
      when r.current_period_end <= now() + interval '1 day 1 hour' then 1
      when r.current_period_end <= now() + interval '7 days 1 hour' and r.current_period_end >= now() + interval '6 days 23 hours' then 7
      else null end;
    if v_days is null then continue; end if;

    select u.email,coalesce(nullif(split_part(coalesce(u.raw_user_meta_data->>'full_name',''),' ',1),''),split_part(u.email,'@',1),'there')
      into v_email,v_first_name from auth.users u where u.id=r.user_id;
    if v_email is null then continue; end if;

    v_event_key := 'subscription-renewal-upcoming:'||r.id::text||':'||v_days::text||':'||to_char(r.current_period_end at time zone 'UTC','YYYYMMDD');
    perform public.dispatch_fluxknight_lifecycle_event(
      v_event_key,'fluxknight.subscription.renewal_upcoming',v_email,
      jsonb_build_object('first_name',v_first_name,'plan_name',coalesce(r.plan_name,'Fluxknight plan'),'amount',coalesce(r.recurring_fee,0)::text,'currency',coalesce(r.currency,'NGN'),'renewal_date',to_char(r.current_period_end at time zone 'UTC','Mon DD, YYYY'),'billing_url','https://fluxknight.space/portal'),
      r.user_id,r.organization_id,null
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.send_fluxknight_grace_period_warnings()
returns integer
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  r record;
  v_email text;
  v_first_name text;
  v_count integer := 0;
begin
  for r in
    select s.id,s.organization_id,s.grace_period_end,b.name as plan_name,m.user_id
    from public.organization_subscriptions s
    join public.billing_plans b on b.id=s.plan_id
    join lateral (
      select om.user_id from public.organization_memberships om
      where om.organization_id=s.organization_id and om.status='active'
      order by om.created_at asc limit 1
    ) m on true
    where s.status='grace_period' and s.grace_period_end is not null
      and s.grace_period_end > now() and s.grace_period_end <= now() + interval '24 hours'
  loop
    select u.email,coalesce(nullif(split_part(coalesce(u.raw_user_meta_data->>'full_name',''),' ',1),''),split_part(u.email,'@',1),'there')
      into v_email,v_first_name from auth.users u where u.id=r.user_id;
    if v_email is null then continue; end if;
    perform public.dispatch_fluxknight_lifecycle_event(
      'subscription-grace-period:'||r.id::text||':'||to_char(r.grace_period_end at time zone 'UTC','YYYYMMDD'),
      'fluxknight.subscription.grace_period',v_email,
      jsonb_build_object('first_name',v_first_name,'plan_name',coalesce(r.plan_name,'Fluxknight plan'),'grace_period_end',to_char(r.grace_period_end at time zone 'UTC','Mon DD, YYYY'),'billing_url','https://fluxknight.space/portal'),
      r.user_id,r.organization_id,null
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

do $$ begin
  if not exists (select 1 from cron.job where jobname='fluxknight_subscription_reminders') then
    perform cron.schedule('fluxknight_subscription_reminders','15 * * * *','select public.send_fluxknight_subscription_reminders();');
  end if;
  if not exists (select 1 from cron.job where jobname='fluxknight_grace_period_warnings') then
    perform cron.schedule('fluxknight_grace_period_warnings','30 * * * *','select public.send_fluxknight_grace_period_warnings();');
  end if;
end $$;

create index if not exists organization_subscriptions_renewal_scan_idx on public.organization_subscriptions(status,current_period_end) where current_period_end is not null;
create index if not exists organization_subscriptions_grace_scan_idx on public.organization_subscriptions(status,grace_period_end) where grace_period_end is not null;
