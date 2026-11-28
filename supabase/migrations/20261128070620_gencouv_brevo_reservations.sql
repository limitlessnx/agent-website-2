-- Provider-aware reservation migration. Existing batches remain Resend.
begin;
do $$ begin
  if (select md5(prosrc) from pg_proc where oid='public.gencouv_reserve_send_batch(uuid,uuid,text,jsonb,text)'::regprocedure) is distinct from '817fa0329a5c80856bec025dea3c23cb' then raise exception 'Gencouv reservation source changed; reconcile before migration'; end if;
end $$;
alter table public.gencouv_send_batches add column provider text not null default 'resend' check (provider in ('resend','brevo'));
create index gencouv_send_batches_provider_day_idx on public.gencouv_send_batches(organization_id,provider,created_at);
create or replace function public.gencouv_reserve_send_batch(p_organization_id uuid,p_request_key uuid,p_request_hash text,p_input jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_existing record; v_batch uuid; v_campaign uuid:=nullif(p_input->>'campaign_id','')::uuid;
  v_provider text:=coalesce(p_input->>'provider','resend');
  v_mode text:=p_input->>'mode'; v_category uuid:=nullif(p_input->>'category_id','')::uuid;
  v_recipients jsonb:='[]'; v_contact record; v_email text; v_id text; v_count integer; v_used integer; v_limit integer; v_position integer:=0;
begin
  if p_organization_id <> '05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid or length(btrim(coalesce(p_actor,'')))<3 then raise exception 'Gencouv actor required'; end if;
  if p_organization_id is null or p_request_key is null or p_request_hash is null then raise exception 'Invalid request identity'; end if;
  if v_provider not in ('resend','brevo') or (v_provider='brevo' and v_mode is distinct from 'one_time') then raise exception 'Invalid provider selection'; end if;
  perform pg_advisory_xact_lock(hashtext('gencouv_send'),hashtext(p_organization_id::text));
  select * into v_existing from public.gencouv_send_batches where organization_id=p_organization_id and request_key=p_request_key;
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception 'Request ID was already used for different content'; end if;
    return public.gencouv_batch_result(p_organization_id,v_existing.id);
  end if;
  if p_input->>'from' is null or p_input->>'subject' is null or p_input->>'text' is null or p_input->>'confirmed' is distinct from 'true' then raise exception 'Invalid recipient selection'; end if;
  if v_provider='resend' and p_input->>'from' not in ('info@gencouv.com','support@gencouv.com','onboarding@gencouv.com') then
    raise exception 'Invalid recipient selection';
  end if;
  if v_provider='brevo' and (
    split_part(p_input->>'from','@',2)='gencouv.com'
    or not exists(select 1 from public.gencouv_campaign_settings
      where organization_id=p_organization_id and campaign_key='gencouv_long_form_copy_trading'
      and jsonb_typeof(metadata->'brevo_approved_senders')='array'
      and (metadata->'brevo_approved_senders') ? (p_input->>'from'))
    or coalesce(p_input->>'brevo_capacity','') !~ '^[0-9]{1,12}$'
  ) then raise exception 'Invalid recipient selection'; end if;
  if v_campaign is not null then
    perform 1 from public.gencouv_bulk_campaigns where id=v_campaign and organization_id=p_organization_id and status in ('draft','ready') and subject=p_input->>'subject' and text_body=p_input->>'text' and (v_mode='one_time' or from_email=p_input->>'from') and category_id is not distinct from v_category for update;
    if not found then raise exception 'Campaign is not available'; end if;
  end if;
  if v_category is not null and not exists(select 1 from public.crm_lead_categories where id=v_category and organization_id=p_organization_id) then raise exception 'Invalid recipient selection'; end if;
  if v_mode='one_time' then
    if jsonb_typeof(p_input->'contact_ids') is distinct from 'array' then raise exception 'Invalid recipient selection'; end if;
    v_count:=jsonb_array_length(p_input->'contact_ids');
    if v_count not between 1 and 100 or p_input->>'consent_confirmed' is distinct from 'true' or (select count(distinct value) from jsonb_array_elements_text(p_input->'contact_ids'))<>v_count then raise exception 'Invalid recipient selection'; end if;
    for v_id in select value from jsonb_array_elements_text(p_input->'contact_ids') loop
      select * into v_contact from public.crm_customers where organization_id=p_organization_id and id=v_id::uuid for share;
      if not found or v_contact.status in ('blocked','archived','unsubscribed','bounced','complained') or coalesce(v_contact.metadata->>'marketing_consent','unknown')<>'granted'
        or coalesce(v_contact.metadata->>'consent_source',v_contact.metadata->>'marketing_consent_source','')=''
        or coalesce(v_contact.metadata->>'consent_recorded_at',v_contact.metadata->>'marketing_consent_verified_at','')='' then raise exception 'Contact permission or suppression check failed'; end if;
      if v_category is not null and not exists(select 1 from public.crm_customer_category_assignments where organization_id=p_organization_id and category_id=v_category and customer_id=v_contact.id) then raise exception 'Invalid recipient selection'; end if;
      v_email:=lower(btrim(v_contact.email));
      if v_email is null or v_email!~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' or exists(select 1 from jsonb_array_elements(v_recipients) r where r->>'email'=v_email) then raise exception 'Invalid recipient selection'; end if;
      if v_provider='brevo' and coalesce(jsonb_typeof(p_input->'brevo_test_recipients'),'null')<>'null' and
        (v_count<>1 or jsonb_typeof(p_input->'brevo_test_recipients')<>'array'
        or not ((p_input->'brevo_test_recipients') ? v_email)) then
        raise exception 'Invalid recipient selection';
      end if;
      if exists(select 1 from public.gencouv_suppression_list where organization_id=p_organization_id and normalized_email=v_email) then raise exception 'Contact permission or suppression check failed'; end if;
      if v_campaign is not null and exists(select 1 from public.gencouv_email_messages where organization_id=p_organization_id and bulk_campaign_id=v_campaign and lower(recipient_email)=v_email and (status<>'failed' or provider_email_id is not null)) then raise exception 'Duplicate campaign recipient'; end if;
      v_recipients:=v_recipients||jsonb_build_array(jsonb_build_object('id',v_contact.id,'email',v_email,'name',nullif(btrim(v_contact.full_name),'')));
    end loop;
  elsif v_mode='proposal' then
    v_count:=1;v_email:=lower(btrim(p_input->>'to'));
    if v_email is null or v_email!~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' then raise exception 'Invalid recipient selection'; end if;
    if exists(select 1 from public.gencouv_suppression_list where organization_id=p_organization_id and normalized_email=v_email)
      or exists(select 1 from public.crm_customers where organization_id=p_organization_id and lower(email)=v_email and status in ('blocked','archived','unsubscribed','bounced','complained')) then raise exception 'Contact permission or suppression check failed'; end if;
    v_recipients:=jsonb_build_array(jsonb_build_object('email',v_email,'name',null));
  else raise exception 'Automation submissions must use a verified worker'; end if;
  select case when coalesce(metadata->>'manual_daily_send_limit','')~'^\d{1,5}$' then least(10000,greatest(1,(metadata->>'manual_daily_send_limit')::integer)) else 100 end into v_limit from public.gencouv_campaign_settings where organization_id=p_organization_id and campaign_key='gencouv_long_form_copy_trading';
  v_limit:=case when v_provider='brevo' then least(300,(p_input->>'brevo_capacity')::bigint)::integer else coalesce(v_limit,100) end;
  select coalesce(sum(recipient_count),0) into v_used from public.gencouv_send_batches where organization_id=p_organization_id and provider=v_provider and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and status not in ('failed','cancelled');
  if v_used+v_count>v_limit then raise exception 'Daily sending limit reached'; end if;
  insert into public.gencouv_send_batches(organization_id,request_key,request_hash,campaign_id,mode,recipient_count,from_email,subject,text_body,actor_email,provider)
    values(p_organization_id,p_request_key,p_request_hash,v_campaign,v_mode,v_count,p_input->>'from',p_input->>'subject',p_input->>'text',p_actor,v_provider) returning id into v_batch;
  for v_contact in select value as data from jsonb_array_elements(v_recipients) loop
    insert into public.gencouv_email_messages(organization_id,send_batch_id,bulk_campaign_id,recipient_email,recipient_name,provider,subject,status,direction,from_email,text_body,metadata)
    values(p_organization_id,v_batch,v_campaign,v_contact.data->>'email',v_contact.data->>'name',v_provider,p_input->>'subject','queued','outbound',p_input->>'from',replace(regexp_replace(p_input->>'text','\[name\]','[Name]','gi'),'[Name]',coalesce(v_contact.data->>'name','there')),
      jsonb_build_object('source','gencouv_dashboard','contact_id',v_contact.data->>'id','batch_position',v_position,'mode',v_mode));
    v_position:=v_position+1;
  end loop;
  if nullif(p_input->>'reply_message_id','') is not null then
    if v_mode<>'proposal' or not exists(select 1 from public.gencouv_email_messages where id=(p_input->>'reply_message_id')::uuid and organization_id=p_organization_id and direction='inbound' and lower(recipient_email)=v_email) then raise exception 'Invalid reply context'; end if;
    update public.gencouv_email_messages outgoing set reply_to_message_id=inbound.id,in_reply_to_header=p_input->'reply_headers'->>'In-Reply-To',references_header=p_input->'reply_headers'->>'References',sequence_id=inbound.sequence_id,sequence_step_id=inbound.sequence_step_id,lead_id=inbound.lead_id
    from public.gencouv_email_messages inbound where inbound.id=(p_input->>'reply_message_id')::uuid and inbound.organization_id=p_organization_id and outgoing.send_batch_id=v_batch and outgoing.organization_id=p_organization_id;
  end if;
  if v_campaign is not null then update public.gencouv_bulk_campaigns set status='ready',consent_confirmed=true,consent_confirmed_at=now(),updated_at=now() where id=v_campaign and organization_id=p_organization_id; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata) values(p_organization_id,'gencouv.email_batch_reserved','gencouv_send_batch',v_batch::text,jsonb_build_object('actor_email',p_actor,'recipients',v_count,'mode',v_mode,'provider',v_provider));
  return public.gencouv_batch_result(p_organization_id,v_batch)||jsonb_build_object('created',true);
end;
$$;


revoke all on function public.gencouv_reserve_send_batch(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gencouv_reserve_send_batch(uuid,uuid,text,jsonb,text) to service_role;
commit;
