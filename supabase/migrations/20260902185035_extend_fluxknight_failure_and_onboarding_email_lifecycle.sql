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
set search_path to 'public','extensions','vault','net'
as $$
declare
  v_api_key text;
  v_request_id bigint;
  v_event_id uuid;
  v_existing_status text;
begin
  if p_event_key is null or btrim(p_event_key) = '' then raise exception 'event key is required'; end if;
  if p_event_type not in (
    'fluxknight.user.verified',
    'fluxknight.payment.succeeded',
    'fluxknight.payment.failed',
    'fluxknight.workspace.ready',
    'fluxknight.provisioning.failed',
    'fluxknight.onboarding.incomplete'
  ) then raise exception 'unsupported lifecycle event type: %', p_event_type; end if;
  if p_recipient_email is null or btrim(p_recipient_email) = '' then raise exception 'recipient email is required'; end if;

  insert into public.transactional_email_events(event_key,event_type,user_id,organization_id,payment_attempt_id,recipient_email,payload,status,updated_at)
  values (p_event_key,p_event_type,p_user_id,p_organization_id,p_payment_attempt_id,lower(btrim(p_recipient_email)),coalesce(p_payload,'{}'::jsonb),'pending',now())
  on conflict (event_key) do nothing returning id into v_event_id;

  if v_event_id is null then
    select id,status into v_event_id,v_existing_status from public.transactional_email_events where event_key=p_event_key;
    if v_existing_status in ('sent','pending') then
      return jsonb_build_object('ok',true,'skipped',true,'reason','duplicate_event_key');
    end if;
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
$$;

revoke all on function public.dispatch_fluxknight_lifecycle_event(text,text,text,jsonb,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.dispatch_fluxknight_lifecycle_event(text,text,text,jsonb,uuid,uuid,uuid) to service_role;

create or replace function public.notify_fluxknight_provisioning_failed()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  v_payment public.payment_attempts%rowtype;
  v_org_name text;
  v_email text;
  v_first_name text;
  v_reason text;
begin
  if new.status <> 'failed' or old.status is not distinct from new.status or new.payment_attempt_id is null then return new; end if;
  select * into v_payment from public.payment_attempts where id=new.payment_attempt_id;
  if v_payment.id is null then return new; end if;
  select name into v_org_name from public.organizations where id=v_payment.organization_id;
  if v_payment.created_by is not null then
    select email, coalesce(nullif(split_part(coalesce(raw_user_meta_data->>'full_name',''),' ',1),''),split_part(email,'@',1),'there')
      into v_email,v_first_name from auth.users where id=v_payment.created_by;
  end if;
  if v_email is null then return new; end if;
  v_reason := coalesce(nullif(new.last_error,''), 'A ' || replace(new.job_type,'_',' ') || ' task could not be completed.');
  perform public.dispatch_fluxknight_lifecycle_event(
    'provisioning-failed:'||v_payment.id::text,
    'fluxknight.provisioning.failed',
    v_email,
    jsonb_build_object('first_name',v_first_name,'workspace_name',coalesce(v_org_name,'your Fluxknight workspace'),'reason',v_reason,'support_url','https://fluxknight.space/portal/support'),
    v_payment.created_by,v_payment.organization_id,v_payment.id
  );
  return new;
end;
$$;
revoke all on function public.notify_fluxknight_provisioning_failed() from public, anon, authenticated;

drop trigger if exists trg_fluxknight_provisioning_failed on public.provisioning_jobs;
create trigger trg_fluxknight_provisioning_failed after update of status on public.provisioning_jobs for each row execute function public.notify_fluxknight_provisioning_failed();

create or replace function public.send_fluxknight_incomplete_onboarding_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  r record;
  v_count integer := 0;
  v_email text;
  v_first_name text;
begin
  for r in
    select p.id,p.organization_id,p.user_id,p.current_step
    from public.client_onboarding_profiles p
    where p.status='in_progress'
      and p.completed_at is null
      and p.updated_at <= now() - interval '24 hours'
      and not exists (select 1 from public.transactional_email_events e where e.event_key='onboarding-incomplete:'||p.id::text and e.status in ('pending','sent'))
  loop
    select email,coalesce(nullif(split_part(coalesce(raw_user_meta_data->>'full_name',''),' ',1),''),split_part(email,'@',1),'there')
      into v_email,v_first_name from auth.users where id=r.user_id;
    if v_email is not null then
      perform public.dispatch_fluxknight_lifecycle_event(
        'onboarding-incomplete:'||r.id::text,
        'fluxknight.onboarding.incomplete',
        v_email,
        jsonb_build_object('first_name',v_first_name,'current_step',least(greatest(coalesce(r.current_step,1),1),4),'onboarding_url','https://fluxknight.space/portal'),
        r.user_id,r.organization_id,null
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.send_fluxknight_incomplete_onboarding_reminders() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname='fluxknight_incomplete_onboarding_reminders';
select cron.schedule('fluxknight_incomplete_onboarding_reminders','0 * * * *','select public.send_fluxknight_incomplete_onboarding_reminders();');
