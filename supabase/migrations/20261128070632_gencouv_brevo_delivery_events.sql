-- Brevo delivery events: service-role-only, known recipient and receipt required.
create or replace function public.gencouv_apply_brevo_event(p_event_id text,p_type text,p_provider_id text,p_email text,p_occurred_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_org constant uuid := '05737e03-f8f0-4202-8e9b-0a8982a1091c';
  m public.gencouv_email_messages%rowtype;
  inserted uuid;
  next_status text;
begin
  if p_type is null or p_type not in ('submitted','delivered','bounced','complained','unsubscribed','failed','opened','clicked','delivery_delayed')
    or p_event_id is null or length(p_event_id)<>64 or p_provider_id is null or length(p_provider_id) not between 1 and 512
    or p_email is null or p_occurred_at is null or p_occurred_at>now()+interval '5 minutes' then raise exception 'Invalid Brevo event'; end if;
  select * into m from public.gencouv_email_messages where organization_id=v_org and provider='brevo' and direction='outbound'
    and provider_email_id=p_provider_id and lower(recipient_email)=lower(p_email) for update;
  if not found then return jsonb_build_object('unmatched',true); end if;
  insert into public.gencouv_email_events(organization_id,email_message_id,provider,provider_event_id,provider_email_id,event_type,occurred_at,payload)
    values(v_org,m.id,'brevo',p_event_id,p_provider_id,p_type,p_occurred_at,jsonb_build_object('email',lower(p_email)))
    on conflict(provider,provider_event_id) do nothing returning id into inserted;
  if inserted is null then return jsonb_build_object('duplicate',true); end if;
  next_status:=case
    when m.status in ('bounced','complained','unsubscribed') then m.status
    when p_type in ('bounced','complained','unsubscribed') then p_type
    when p_type='delivered' and m.status in ('queued','unknown','submitted','delivery_delayed') then 'delivered'
    when m.last_event_at is not null and p_occurred_at<m.last_event_at then m.status
    when p_type in ('opened','clicked','delivery_delayed') then m.status
    when m.status in ('delivered','replied') and p_type='submitted' then m.status
    when m.status='failed' and p_type='submitted' then m.status
    else p_type end;
  update public.gencouv_email_messages set status=next_status,
    sent_at=case when p_type='submitted' then coalesce(sent_at,p_occurred_at) else sent_at end,
    delivered_at=case when p_type='delivered' then coalesce(delivered_at,p_occurred_at) else delivered_at end,
    opened_at=case when p_type='opened' then coalesce(opened_at,p_occurred_at) else opened_at end,
    clicked_at=case when p_type='clicked' then coalesce(clicked_at,p_occurred_at) else clicked_at end,
    bounced_at=case when p_type='bounced' then coalesce(bounced_at,p_occurred_at) else bounced_at end,
    complained_at=case when p_type='complained' then coalesce(complained_at,p_occurred_at) else complained_at end,
    failed_at=case when p_type='failed' then coalesce(failed_at,p_occurred_at) else failed_at end,
    last_event_at=greatest(coalesce(last_event_at,p_occurred_at),p_occurred_at),updated_at=now()
    where id=m.id and organization_id=v_org and provider='brevo';
  if p_type in ('bounced','complained','unsubscribed') then
    insert into public.gencouv_suppression_list(organization_id,normalized_email,reason,source,event_type,provider_email_id,payload,updated_at)
      values(v_org,lower(p_email),p_type,'brevo',p_type,p_provider_id,'{}'::jsonb,now())
      on conflict(organization_id,normalized_email) do nothing;
    update public.gencouv_campaign_enrollments set do_not_contact=true,campaign_status='stopped',stop_reason=p_type,last_delivery_status=p_type,updated_at=now()
      where organization_id=v_org and normalized_email=lower(p_email);
  end if;
  return jsonb_build_object('applied',true,'status',next_status);
end;
$$;
revoke all on function public.gencouv_apply_brevo_event(text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.gencouv_apply_brevo_event(text,text,text,text,timestamptz) to service_role;

-- Restrict the existing Resend event lookups without changing its event semantics.
do $$
declare
  v_oid regprocedure := 'public.gencouv_apply_delivery_event(text,text,jsonb,timestamptz)'::regprocedure;
  v_definition text;
begin
  if (select md5(prosrc) from pg_proc where oid=v_oid) is distinct from '340ef4c7549f9c72c3034238f040b673' then
    raise exception 'Gencouv Resend delivery source changed; reconcile before migration';
  end if;
  v_definition := replace(pg_get_functiondef(v_oid),
    'organization_id=v_org and provider_email_id=v_provider for update',
    'organization_id=v_org and provider=''resend'' and provider_email_id=v_provider for update');
  v_definition := replace(v_definition,
    'organization_id=v_org and id=v_id::uuid for update',
    'organization_id=v_org and provider=''resend'' and id=v_id::uuid for update');
  execute v_definition;
end;
$$;
