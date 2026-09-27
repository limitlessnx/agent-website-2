create or replace function public.dispatch_fluxknight_lifecycle_event(
  p_event_key text,
  p_event_type text,
  p_recipient_email text,
  p_payload jsonb,
  p_user_id uuid default null,
  p_organization_id uuid default null,
  p_payment_attempt_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, vault, net
as $$
declare
  v_api_key text;
  v_request_id bigint;
  v_event_id uuid;
  v_existing_status text;
begin
  if p_event_key is null or btrim(p_event_key) = '' then
    raise exception 'event key is required';
  end if;
  if p_event_type not in ('fluxknight.user.verified','fluxknight.payment.succeeded','fluxknight.workspace.ready') then
    raise exception 'unsupported lifecycle event type: %', p_event_type;
  end if;
  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    raise exception 'recipient email is required';
  end if;

  insert into public.transactional_email_events (
    event_key,
    event_type,
    user_id,
    organization_id,
    payment_attempt_id,
    recipient_email,
    payload,
    status,
    updated_at
  ) values (
    p_event_key,
    p_event_type,
    p_user_id,
    p_organization_id,
    p_payment_attempt_id,
    lower(btrim(p_recipient_email)),
    coalesce(p_payload, '{}'::jsonb),
    'pending',
    now()
  )
  on conflict (event_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select id, status into v_event_id, v_existing_status
    from public.transactional_email_events
    where event_key = p_event_key;

    if v_existing_status in ('sent','pending') then
      return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'duplicate_event_key');
    end if;

    update public.transactional_email_events
      set status = 'pending',
          last_error = null,
          payload = coalesce(p_payload, '{}'::jsonb),
          recipient_email = lower(btrim(p_recipient_email)),
          provider_response = null,
          sent_at = null,
          updated_at = now()
    where id = v_event_id;
  end if;

  select decrypted_secret
    into v_api_key
  from vault.decrypted_secrets
  where name = 'fluxknight_resend_api_key'
  limit 1;

  if v_api_key is null or btrim(v_api_key) = '' then
    update public.transactional_email_events
      set status = 'failed', last_error = 'Fluxknight Resend Vault secret missing', updated_at = now()
    where id = v_event_id;
    raise exception 'Fluxknight Resend Vault secret missing';
  end if;

  select net.http_post(
    url := 'https://api.resend.com/events',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_api_key,
      'Content-Type', 'application/json',
      'User-Agent', 'fluxknight-supabase-lifecycle/1.0'
    ),
    body := jsonb_build_object(
      'name', p_event_type,
      'email', lower(btrim(p_recipient_email)),
      'payload', coalesce(p_payload, '{}'::jsonb)
    )
  ) into v_request_id;

  update public.transactional_email_events
    set status = 'pending',
        provider_response = jsonb_build_object('pg_net_request_id', v_request_id),
        last_error = null,
        updated_at = now()
  where id = v_event_id;

  return jsonb_build_object('ok', true, 'skipped', false, 'request_id', v_request_id);
exception
  when others then
    if v_event_id is not null then
      update public.transactional_email_events
        set status = 'failed', last_error = sqlerrm, updated_at = now()
      where id = v_event_id;
    end if;
    raise;
end;
$$;

revoke all on function public.dispatch_fluxknight_lifecycle_event(text,text,text,jsonb,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.dispatch_fluxknight_lifecycle_event(text,text,text,jsonb,uuid,uuid,uuid) to service_role;

create or replace function public.reconcile_fluxknight_lifecycle_events()
returns integer
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_updated integer := 0;
begin
  with responses as (
    select
      e.id as event_id,
      r.status_code,
      r.error_msg,
      r.content
    from public.transactional_email_events e
    join net._http_response r
      on r.id = nullif(e.provider_response->>'pg_net_request_id','')::bigint
    where e.status = 'pending'
  ), updated as (
    update public.transactional_email_events e
    set status = case when responses.status_code between 200 and 299 then 'sent' else 'failed' end,
        sent_at = case when responses.status_code between 200 and 299 then now() else null end,
        last_error = case
          when responses.status_code between 200 and 299 then null
          else coalesce(responses.error_msg, responses.content, 'Resend event request failed')
        end,
        provider_response = coalesce(e.provider_response, '{}'::jsonb) || jsonb_build_object(
          'http_status', responses.status_code,
          'response_content', responses.content
        ),
        updated_at = now()
    from responses
    where e.id = responses.event_id
    returning e.id
  )
  select count(*) into v_updated from updated;

  return v_updated;
end;
$$;

revoke all on function public.reconcile_fluxknight_lifecycle_events() from public, anon, authenticated;
grant execute on function public.reconcile_fluxknight_lifecycle_events() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'fluxknight_lifecycle_email_reconcile') then
    perform cron.schedule(
      'fluxknight_lifecycle_email_reconcile',
      '* * * * *',
      'select public.reconcile_fluxknight_lifecycle_events();'
    );
  end if;
end;
$$;
