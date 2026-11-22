begin;

-- Reuses the reviewed campaign concept from PR #439 and the existing message ledger.
create table if not exists public.gencouv_bulk_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  category_id uuid,
  from_email text not null,
  subject text not null,
  text_body text not null,
  status text not null default 'draft' check(status in ('draft','ready','closed')),
  consent_confirmed boolean not null default false,
  consent_basis text not null default '',
  consent_confirmed_at timestamptz,
  consent_confirmed_by text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,organization_id)
);
create table if not exists public.gencouv_send_batches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  request_key uuid not null, request_hash text not null, campaign_id uuid,
  mode text not null check(mode in ('one_time','proposal','automation')),
  status text not null default 'queued' check(status in ('queued','submitting','submitted','partial','unknown','failed','cancelled')),
  recipient_count integer not null check(recipient_count between 1 and 100),
  from_email text not null, subject text not null, text_body text not null, actor_email text not null,
  error_summary text, submitted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,request_key), unique(id,organization_id),
  foreign key(campaign_id,organization_id) references public.gencouv_bulk_campaigns(id,organization_id)
);
alter table public.gencouv_email_messages add column if not exists send_batch_id uuid;
alter table public.gencouv_email_messages add column if not exists bulk_campaign_id uuid;
alter table public.gencouv_email_messages add constraint gencouv_message_batch_scope_fk foreign key(send_batch_id,organization_id) references public.gencouv_send_batches(id,organization_id);
alter table public.gencouv_email_messages add constraint gencouv_message_campaign_scope_fk foreign key(bulk_campaign_id,organization_id) references public.gencouv_bulk_campaigns(id,organization_id);
create unique index if not exists gencouv_campaign_recipient_reservation on public.gencouv_email_messages(bulk_campaign_id,lower(recipient_email))
  where bulk_campaign_id is not null and (status <> 'failed' or provider_email_id is not null);
create index if not exists gencouv_batch_history on public.gencouv_send_batches(organization_id,created_at desc);
alter table public.gencouv_bulk_campaigns enable row level security;
alter table public.gencouv_send_batches enable row level security;
revoke all on public.gencouv_bulk_campaigns,public.gencouv_send_batches from public,anon,authenticated;
grant select,insert,update on public.gencouv_bulk_campaigns,public.gencouv_send_batches to service_role;

create or replace function public.gencouv_batch_result(p_organization_id uuid,p_batch_id uuid)
returns jsonb language sql security invoker set search_path=public as $$
  select jsonb_build_object('created',false,'batch_id',b.id,'status',b.status,'messages',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'recipient_email',m.recipient_email,'recipient_name',m.recipient_name,'provider_email_id',m.provider_email_id,'status',m.status) order by (m.metadata->>'batch_position')::integer) from public.gencouv_email_messages m where m.organization_id=b.organization_id and m.send_batch_id=b.id),'[]'::jsonb))
  from public.gencouv_send_batches b where b.organization_id=p_organization_id and b.id=p_batch_id;
$$;

create or replace function public.gencouv_reserve_send_batch(p_organization_id uuid,p_request_key uuid,p_request_hash text,p_input jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_existing record; v_batch uuid; v_campaign uuid:=nullif(p_input->>'campaign_id','')::uuid;
  v_mode text:=p_input->>'mode'; v_category uuid:=nullif(p_input->>'category_id','')::uuid;
  v_recipients jsonb:='[]'; v_contact record; v_email text; v_id text; v_count integer; v_used integer; v_limit integer; v_position integer:=0;
begin
  if p_organization_id <> '05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid or length(btrim(coalesce(p_actor,'')))<3 then raise exception 'Gencouv actor required'; end if;
  perform pg_advisory_xact_lock(hashtext('gencouv_send'),hashtext(p_organization_id::text));
  select * into v_existing from public.gencouv_send_batches where organization_id=p_organization_id and request_key=p_request_key;
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception 'Request ID was already used for different content'; end if;
    return public.gencouv_batch_result(p_organization_id,v_existing.id);
  end if;
  if p_input->>'from' not in ('info@gencouv.com','support@gencouv.com','onboarding@gencouv.com') or p_input->>'subject' is null or p_input->>'text' is null or p_input->>'confirmed' is distinct from 'true' then raise exception 'Invalid recipient selection'; end if;
  if v_campaign is not null then
    perform 1 from public.gencouv_bulk_campaigns where id=v_campaign and organization_id=p_organization_id and status in ('draft','ready') and subject=p_input->>'subject' and text_body=p_input->>'text' and from_email=p_input->>'from' and category_id is not distinct from v_category for update;
    if not found then raise exception 'Campaign is not available'; end if;
  end if;
  if v_category is not null and not exists(select 1 from public.crm_lead_categories where id=v_category and organization_id=p_organization_id) then raise exception 'Invalid recipient selection'; end if;
  if v_mode='one_time' then
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
      if exists(select 1 from public.gencouv_suppression_list where organization_id=p_organization_id and normalized_email=v_email) then raise exception 'Contact permission or suppression check failed'; end if;
      if v_campaign is not null and exists(select 1 from public.gencouv_email_messages where organization_id=p_organization_id and bulk_campaign_id=v_campaign and lower(recipient_email)=v_email and (status<>'failed' or provider_email_id is not null)) then raise exception 'Duplicate campaign recipient'; end if;
      v_recipients:=v_recipients||jsonb_build_array(jsonb_build_object('id',v_contact.id,'email',v_email,'name',v_contact.full_name));
    end loop;
  elsif v_mode='proposal' then
    v_count:=1;v_email:=lower(btrim(p_input->>'to'));
    if v_email is null or v_email!~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' then raise exception 'Invalid recipient selection'; end if;
    if exists(select 1 from public.gencouv_suppression_list where organization_id=p_organization_id and normalized_email=v_email)
      or exists(select 1 from public.crm_customers where organization_id=p_organization_id and lower(email)=v_email and status in ('blocked','archived','unsubscribed','bounced','complained')) then raise exception 'Contact permission or suppression check failed'; end if;
    v_recipients:=jsonb_build_array(jsonb_build_object('email',v_email,'name',null));
  else raise exception 'Automation submissions must use a verified worker'; end if;
  select case when coalesce(metadata->>'manual_daily_send_limit','')~'^\d{1,5}$' then least(10000,greatest(1,(metadata->>'manual_daily_send_limit')::integer)) else 100 end into v_limit from public.gencouv_campaign_settings where organization_id=p_organization_id and campaign_key='gencouv_long_form_copy_trading';
  v_limit:=coalesce(v_limit,100);
  select coalesce(sum(recipient_count),0) into v_used from public.gencouv_send_batches where organization_id=p_organization_id and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and status not in ('failed','cancelled');
  if v_used+v_count>v_limit then raise exception 'Daily sending limit reached'; end if;
  insert into public.gencouv_send_batches(organization_id,request_key,request_hash,campaign_id,mode,recipient_count,from_email,subject,text_body,actor_email)
    values(p_organization_id,p_request_key,p_request_hash,v_campaign,v_mode,v_count,p_input->>'from',p_input->>'subject',p_input->>'text',p_actor) returning id into v_batch;
  for v_contact in select value as data from jsonb_array_elements(v_recipients) loop
    insert into public.gencouv_email_messages(organization_id,send_batch_id,bulk_campaign_id,recipient_email,recipient_name,provider,subject,status,direction,from_email,text_body,metadata)
    values(p_organization_id,v_batch,v_campaign,v_contact.data->>'email',v_contact.data->>'name','resend',p_input->>'subject','queued','outbound',p_input->>'from',replace(p_input->>'text','[Name]',coalesce(v_contact.data->>'name','there')),
      jsonb_build_object('source','gencouv_dashboard','contact_id',v_contact.data->>'id','batch_position',v_position,'mode',v_mode));
    v_position:=v_position+1;
  end loop;
  if nullif(p_input->>'reply_message_id','') is not null then
    if v_mode<>'proposal' or not exists(select 1 from public.gencouv_email_messages where id=(p_input->>'reply_message_id')::uuid and organization_id=p_organization_id and direction='inbound' and lower(recipient_email)=v_email) then raise exception 'Invalid reply context'; end if;
    update public.gencouv_email_messages set reply_to_message_id=(p_input->>'reply_message_id')::uuid,in_reply_to_header=p_input->'reply_headers'->>'In-Reply-To',references_header=p_input->'reply_headers'->>'References' where send_batch_id=v_batch and organization_id=p_organization_id;
  end if;
  if v_campaign is not null then update public.gencouv_bulk_campaigns set status='ready',consent_confirmed=true,consent_confirmed_at=now(),updated_at=now() where id=v_campaign and organization_id=p_organization_id; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata) values(p_organization_id,'gencouv.email_batch_reserved','gencouv_send_batch',v_batch::text,jsonb_build_object('actor_email',p_actor,'recipients',v_count,'mode',v_mode));
  return public.gencouv_batch_result(p_organization_id,v_batch)||jsonb_build_object('created',true);
end;
$$;

create or replace function public.gencouv_authorize_send_batch(p_organization_id uuid,p_batch_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_batch record;
begin
  perform pg_advisory_xact_lock(hashtext('gencouv_send'),hashtext(p_organization_id::text));
  select * into v_batch from public.gencouv_send_batches where organization_id=p_organization_id and id=p_batch_id and status='queued' for update;
  if not found then return false; end if;
  if v_batch.mode='automation' and not exists(select 1 from public.gencouv_campaign_settings where organization_id=p_organization_id and sending_enabled=true and status='active') then return false; end if;
  if exists(select 1 from public.gencouv_email_messages m where m.organization_id=p_organization_id and m.send_batch_id=p_batch_id and (exists(select 1 from public.gencouv_suppression_list s where s.organization_id=m.organization_id and s.normalized_email=lower(m.recipient_email)) or
    (v_batch.mode='one_time' and not exists(select 1 from public.crm_customers c where c.organization_id=m.organization_id and c.id::text=m.metadata->>'contact_id' and c.metadata->>'marketing_consent'='granted' and coalesce(c.status,'active') not in ('blocked','archived','unsubscribed','bounced','complained'))))) then
      update public.gencouv_send_batches set status='cancelled',error_summary='Recipient eligibility changed before submission',updated_at=now() where id=p_batch_id and organization_id=p_organization_id;
      update public.gencouv_email_messages set status='failed',error_message='Recipient eligibility changed before submission',updated_at=now() where send_batch_id=p_batch_id and organization_id=p_organization_id and status='queued';
      return false;
  end if;
  update public.gencouv_send_batches set status='submitting',submitted_at=now(),updated_at=now() where id=p_batch_id and organization_id=p_organization_id;
  return true;
end;
$$;

create or replace function public.gencouv_finish_send_batch(p_organization_id uuid,p_batch_id uuid,p_outcome text,p_provider_ids jsonb,p_error text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_message record;v_index integer:=0;v_provider text;
begin
  if p_outcome not in ('submitted','partial','unknown','failed') then raise exception 'Invalid submission result'; end if;
  perform 1 from public.gencouv_send_batches where id=p_batch_id and organization_id=p_organization_id and status='submitting' for update;
  if not found then return public.gencouv_batch_result(p_organization_id,p_batch_id); end if;
  for v_message in select * from public.gencouv_email_messages where send_batch_id=p_batch_id and organization_id=p_organization_id order by (metadata->>'batch_position')::integer for update loop
    v_provider:=nullif(p_provider_ids->>v_index,'');
    update public.gencouv_email_messages set provider_email_id=coalesce(provider_email_id,v_provider),
      status=case when status not in ('queued','submitted','unknown') then status when v_provider is not null then 'submitted' when p_outcome='failed' then 'failed' else 'unknown' end,
      error_message=case when v_provider is not null then null else p_error end,updated_at=now()
      where id=v_message.id and organization_id=p_organization_id;
    v_index:=v_index+1;
  end loop;
  update public.gencouv_send_batches set status=p_outcome,error_summary=p_error,updated_at=now() where id=p_batch_id and organization_id=p_organization_id;
  return public.gencouv_batch_result(p_organization_id,p_batch_id);
end;
$$;

revoke all on function public.gencouv_batch_result(uuid,uuid),public.gencouv_reserve_send_batch(uuid,uuid,text,jsonb,text),public.gencouv_authorize_send_batch(uuid,uuid),public.gencouv_finish_send_batch(uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gencouv_batch_result(uuid,uuid),public.gencouv_reserve_send_batch(uuid,uuid,text,jsonb,text),public.gencouv_authorize_send_batch(uuid,uuid),public.gencouv_finish_send_batch(uuid,uuid,text,jsonb,text) to service_role;

create or replace function public.gencouv_import_contacts(p_organization_id uuid,p_batch_id uuid,p_hash text,p_contacts jsonb,p_category_id uuid,p_consent boolean,p_consent_source text,p_filename text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_prior record;v_row jsonb;v_id uuid;v_new integer:=0;v_existing integer:=0;v_email text;
begin
  if p_organization_id<>'05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid or length(coalesce(p_actor,''))<3 or jsonb_array_length(p_contacts) not between 1 and 500 then raise exception 'Invalid import'; end if;
  if p_consent and length(btrim(coalesce(p_consent_source,'')))<8 then raise exception 'Document the actual permission source'; end if;
  perform pg_advisory_xact_lock(hashtext('gencouv_import'),hashtext(p_organization_id::text));
  select * into v_prior from public.gencouv_sync_runs where id=p_batch_id and organization_id=p_organization_id;
  if found then
    if v_prior.metadata->>'request_hash'<>p_hash then raise exception 'Import request ID already used'; end if;
    return v_prior.metadata->'result';
  end if;
  if p_category_id is not null and not exists(select 1 from public.crm_lead_categories where id=p_category_id and organization_id=p_organization_id) then raise exception 'Invalid category'; end if;
  insert into public.gencouv_sync_runs(id,organization_id,source,direction,status,records_read,metadata)
    values(p_batch_id,p_organization_id,'dashboard','inbound','running',jsonb_array_length(p_contacts),jsonb_build_object('import_kind','document_import','request_hash',p_hash,'filename',left(p_filename,180),'consent_confirmed',p_consent,'consent_source',case when p_consent then p_consent_source else null end,'confirmed_by',p_actor,'confirmed_at',now()));
  for v_row in select value from jsonb_array_elements(p_contacts) loop
    v_email:=lower(btrim(v_row->>'email'));
    if v_email is null or v_email!~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' then raise exception 'Invalid email'; end if;
    select id into v_id from public.crm_customers where organization_id=p_organization_id and lower(btrim(email))=v_email limit 1;
    if found then v_existing:=v_existing+1;
    else
      insert into public.crm_customers(organization_id,full_name,email,company_name,metadata)
        values(p_organization_id,nullif(v_row->>'full_name',''),v_email,nullif(v_row->>'company_name',''),jsonb_build_object('source','gencouv_document_import','import_batch_id',p_batch_id,'import_filename',left(p_filename,180),'marketing_consent',case when p_consent then 'granted' else 'unknown' end,'consent_source',case when p_consent then p_consent_source else null end,'consent_recorded_at',case when p_consent then now() else null end,'consent_recorded_by',case when p_consent then p_actor else null end,'imported_at',now())) returning id into v_id;
      v_new:=v_new+1;
    end if;
    if p_category_id is not null then insert into public.crm_customer_category_assignments(organization_id,customer_id,category_id) values(p_organization_id,v_id,p_category_id) on conflict do nothing; end if;
  end loop;
  update public.gencouv_sync_runs set status='completed',records_written=v_new,completed_at=now(),metadata=metadata||jsonb_build_object('result',jsonb_build_object('imported',v_new,'already_saved',v_existing,'failed',0,'batch_id',p_batch_id)) where id=p_batch_id and organization_id=p_organization_id;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata) values(p_organization_id,'gencouv.contacts_imported','gencouv_sync_run',p_batch_id::text,jsonb_build_object('actor_email',p_actor,'imported',v_new,'existing',v_existing,'consent_confirmed_for_new_contacts',p_consent));
  return jsonb_build_object('imported',v_new,'already_saved',v_existing,'failed',0,'batch_id',p_batch_id);
end;
$$;

create or replace function public.gencouv_update_campaign_state(p_organization_id uuid,p_enabled boolean,p_daily_limit integer,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_settings record;
begin
  if p_organization_id<>'05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid or length(coalesce(p_actor,''))<3 or (p_daily_limit is not null and p_daily_limit not between 1 and 1000) then raise exception 'Invalid campaign settings'; end if;
  perform pg_advisory_xact_lock(hashtext('gencouv_send'),hashtext(p_organization_id::text));
  select * into v_settings from public.gencouv_campaign_settings where organization_id=p_organization_id and campaign_key='gencouv_long_form_copy_trading' for update;
  if not found then raise exception 'Campaign settings unavailable'; end if;
  if p_enabled=true and v_settings.metadata->>'outbound_worker_gate_verified' is distinct from 'true' then raise exception 'Automation worker requires verification before enabling'; end if;
  update public.gencouv_campaign_settings set sending_enabled=coalesce(p_enabled,sending_enabled),status=case when p_enabled is null then status when p_enabled then 'active' else 'paused' end,daily_send_limit=coalesce(p_daily_limit,daily_send_limit),updated_at=now() where id=v_settings.id and organization_id=p_organization_id;
  if p_enabled=false then
    update public.gencouv_send_batches set status='cancelled',error_summary='Automated campaigns paused',updated_at=now() where organization_id=p_organization_id and mode='automation' and status='queued';
  end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata) values(p_organization_id,'gencouv.campaign_settings_updated','gencouv_campaign_settings',v_settings.id::text,jsonb_build_object('actor_email',p_actor,'previous_enabled',v_settings.sending_enabled,'enabled',coalesce(p_enabled,v_settings.sending_enabled),'previous_daily_limit',v_settings.daily_send_limit,'daily_limit',coalesce(p_daily_limit,v_settings.daily_send_limit)));
  return (select jsonb_build_object('enabled',sending_enabled,'daily_limit',daily_send_limit,'worker_verified',metadata->>'outbound_worker_gate_verified'='true') from public.gencouv_campaign_settings where id=v_settings.id);
end;
$$;

create or replace function public.gencouv_apply_delivery_event(p_event_id text,p_type text,p_data jsonb,p_occurred_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  v_org uuid:='05737e03-f8f0-4202-8e9b-0a8982a1091c';v_message record;v_provider text:=coalesce(p_data->>'email_id',p_data->>'id');v_id text;v_status text:=replace(p_type,'email.','');v_email text;v_inserted uuid;v_next text;
begin
  if v_status not in ('sent','delivered','opened','clicked','bounced','failed','complained','suppressed','unsubscribed','delivery_delayed','scheduled') or length(coalesce(p_event_id,''))<3 then raise exception 'Unsupported event'; end if;
  select * into v_message from public.gencouv_email_messages where organization_id=v_org and provider_email_id=v_provider for update;
  if not found then
    v_id:=case when jsonb_typeof(p_data->'tags')='object' then p_data->'tags'->>'gencouv_message_id' else (select t->>'value' from jsonb_array_elements(case when jsonb_typeof(p_data->'tags')='array' then p_data->'tags' else '[]' end) t where t->>'name'='gencouv_message_id' limit 1) end;
    if v_id~'^[0-9a-f-]{36}$' then select * into v_message from public.gencouv_email_messages where organization_id=v_org and id=v_id::uuid for update; end if;
  end if;
  if v_message.id is null then return jsonb_build_object('ignored',true,'reason','message_not_owned'); end if;
  if v_message.provider_email_id is not null and v_message.provider_email_id<>v_provider then raise exception 'Provider message identity mismatch'; end if;
  insert into public.gencouv_email_events(organization_id,email_message_id,provider,provider_event_id,provider_email_id,event_type,occurred_at,payload)
    values(v_org,v_message.id,'resend',p_event_id,v_provider,p_type,p_occurred_at,jsonb_build_object('type',p_type,'data',p_data)) on conflict(provider,provider_event_id) do nothing returning id into v_inserted;
  if v_inserted is null then return jsonb_build_object('duplicate',true); end if;
  v_status:=case when v_status in ('opened','clicked') then 'delivered' when v_status='suppressed' then 'unsubscribed' when v_status in ('delivery_delayed','scheduled') then v_message.status else v_status end;
  v_email:=lower(v_message.recipient_email);
  v_next:=case when v_message.status in ('bounced','complained','unsubscribed') and v_status not in ('bounced','complained','unsubscribed') then v_message.status
    when v_status in ('bounced','complained','unsubscribed') then v_status
    when v_message.last_event_at is not null and p_occurred_at<v_message.last_event_at then v_message.status
    when v_message.status='delivered' and v_status in ('sent','submitted','queued') then v_message.status else v_status end;
  update public.gencouv_email_messages set status=v_next,provider_email_id=coalesce(provider_email_id,v_provider),
    sent_at=case when v_status='sent' then coalesce(sent_at,p_occurred_at) else sent_at end,
    delivered_at=case when v_status='delivered' then coalesce(delivered_at,p_occurred_at) else delivered_at end,
    bounced_at=case when v_status='bounced' then coalesce(bounced_at,p_occurred_at) else bounced_at end,
    complained_at=case when v_status='complained' then coalesce(complained_at,p_occurred_at) else complained_at end,
    failed_at=case when v_status='failed' then coalesce(failed_at,p_occurred_at) else failed_at end,
    last_event_at=greatest(coalesce(last_event_at,p_occurred_at),p_occurred_at),updated_at=now() where id=v_message.id and organization_id=v_org;
  if v_status in ('bounced','complained','unsubscribed') then
    insert into public.gencouv_suppression_list(organization_id,normalized_email,reason,source,event_type,provider_email_id,payload,updated_at)
      values(v_org,v_email,v_status,'resend',p_type,v_provider,p_data,now()) on conflict(organization_id,normalized_email) do update set reason=excluded.reason,event_type=excluded.event_type,updated_at=now();
    update public.gencouv_campaign_enrollments set do_not_contact=true,campaign_status='stopped',stop_reason=v_status,last_delivery_status=v_status,updated_at=now() where organization_id=v_org and normalized_email=v_email;
  end if;
  return jsonb_build_object('applied',true,'message_id',v_message.id,'status',v_next);
end;
$$;

create or replace function public.gencouv_unsubscribe_message(p_message_id uuid)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_org uuid:='05737e03-f8f0-4202-8e9b-0a8982a1091c';v_email text;
begin
  select lower(recipient_email) into v_email from public.gencouv_email_messages where id=p_message_id and organization_id=v_org and metadata->>'mode'='one_time';
  if not found then return false; end if;
  insert into public.gencouv_suppression_list(organization_id,normalized_email,reason,source,updated_at) values(v_org,v_email,'unsubscribed','recipient_one_click',now()) on conflict(organization_id,normalized_email) do nothing;
  update public.crm_customers set metadata=coalesce(metadata,'{}')||jsonb_build_object('marketing_consent','denied','unsubscribed_at',now()),updated_at=now() where organization_id=v_org and lower(email)=v_email;
  update public.gencouv_campaign_enrollments set do_not_contact=true,unsubscribe_status='unsubscribed',campaign_status='stopped',stop_reason='unsubscribed',updated_at=now() where organization_id=v_org and normalized_email=v_email;
  update public.gencouv_email_messages set status='unsubscribed',stop_reason='unsubscribed',updated_at=now() where id=p_message_id and organization_id=v_org;
  return true;
end;
$$;

revoke all on function public.gencouv_import_contacts(uuid,uuid,text,jsonb,uuid,boolean,text,text,text),public.gencouv_update_campaign_state(uuid,boolean,integer,text),public.gencouv_apply_delivery_event(text,text,jsonb,timestamptz),public.gencouv_unsubscribe_message(uuid) from public,anon,authenticated;
grant execute on function public.gencouv_import_contacts(uuid,uuid,text,jsonb,uuid,boolean,text,text,text),public.gencouv_update_campaign_state(uuid,boolean,integer,text),public.gencouv_apply_delivery_event(text,text,jsonb,timestamptz),public.gencouv_unsubscribe_message(uuid) to service_role;


-- Existing enrollment entrypoint must fail closed while paused or unverified.
create or replace function public.gencouv_prepare_daily_enrollments(
  p_organization_id uuid,
  p_campaign_key text default 'gencouv_long_form_copy_trading',
  p_requested_limit integer default null
)
returns table(
  enrollment_id uuid,
  lead_id uuid,
  normalized_email text,
  email text,
  first_name text,
  last_name text,
  full_name text,
  product_interest text,
  broker text,
  cohort_date date,
  campaign_status text
)
language sql
set search_path = public, pg_temp
as $function$
  with settings as (
    select least(200, greatest(1, coalesce(p_requested_limit, s.daily_new_lead_limit, 1)), greatest(1,s.daily_send_limit)) as lead_limit
    from public.gencouv_campaign_settings s
    where s.organization_id = p_organization_id
      and s.campaign_key = p_campaign_key
      and s.sending_enabled = true and s.status = 'active'
      and s.metadata->>'outbound_worker_gate_verified'='true'
      and p_organization_id='05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid
  ), pending_existing as (
    select
      e.id as enrollment_id,
      q.id as lead_id,
      q.normalized_email,
      q.email,
      q.first_name,
      q.last_name,
      q.full_name,
      q.product_interest,
      q.broker,
      e.cohort_date,
      e.campaign_status,
      q.quality_score,
      q.created_at
    from public.gencouv_campaign_enrollments e
    join public.gencouv_qualified_leads q
      on q.organization_id = e.organization_id
     and q.normalized_email = e.normalized_email
    where e.organization_id = p_organization_id
      and e.campaign_key = p_campaign_key
      and e.campaign_status = 'pending_send'
      and exists(select 1 from settings)
      and exists(select 1 from public.crm_customers c where c.organization_id=q.organization_id and lower(btrim(c.email))=q.normalized_email
        and c.metadata->>'marketing_consent'='granted'
        and coalesce(c.metadata->>'consent_source',c.metadata->>'marketing_consent_source','')<>''
        and coalesce(c.metadata->>'consent_recorded_at',c.metadata->>'marketing_consent_verified_at','')<>''
        and coalesce(c.status,'active') not in ('blocked','archived','unsubscribed','bounced','complained'))
      and q.normalized_email is not null
      and btrim(q.normalized_email) <> ''
      and lower(q.qualification_status) = 'qualified'
      and lower(coalesce(q.validation_status, 'valid')) not in ('invalid', 'failed', 'bounced', 'suppressed')
      and coalesce(q.do_not_contact, false) = false
      and lower(coalesce(q.suppression_status, 'clear')) not in ('suppressed', 'blocked', 'do_not_contact', 'complained')
      and lower(coalesce(q.unsubscribe_status, 'not_unsubscribed')) not in ('unsubscribed', 'opted_out', 'do_not_contact')
      and lower(coalesce(q.bounce_status, 'clear')) not in ('bounced', 'complained', 'failed', 'suppressed')
      and not exists (
        select 1
        from public.gencouv_suppression_list sl
        where sl.organization_id = q.organization_id
          and sl.normalized_email = q.normalized_email
      )
    order by q.quality_score desc, e.campaign_enrolled_at asc, e.id asc
    limit coalesce((select lead_limit from settings),0)
  ), eligible as (
    select q.*
    from public.gencouv_qualified_leads q
    where q.organization_id = p_organization_id
      and exists(select 1 from settings)
      and exists(select 1 from public.crm_customers c where c.organization_id=q.organization_id and lower(btrim(c.email))=q.normalized_email
        and c.metadata->>'marketing_consent'='granted'
        and coalesce(c.metadata->>'consent_source',c.metadata->>'marketing_consent_source','')<>''
        and coalesce(c.metadata->>'consent_recorded_at',c.metadata->>'marketing_consent_verified_at','')<>''
        and coalesce(c.status,'active') not in ('blocked','archived','unsubscribed','bounced','complained'))
      and q.normalized_email is not null
      and btrim(q.normalized_email) <> ''
      and lower(q.qualification_status) = 'qualified'
      and lower(coalesce(q.validation_status, 'valid')) not in ('invalid', 'failed', 'bounced', 'suppressed')
      and lower(coalesce(q.campaign_status, 'qualified')) not in ('enrolled', 'active', 'completed', 'stopped')
      and lower(coalesce(q.email_sequence_status, 'ready_not_started')) not in ('enrolled', 'active', 'completed', 'stopped')
      and coalesce(q.do_not_contact, false) = false
      and lower(coalesce(q.suppression_status, 'clear')) not in ('suppressed', 'blocked', 'do_not_contact', 'complained')
      and lower(coalesce(q.unsubscribe_status, 'not_unsubscribed')) not in ('unsubscribed', 'opted_out', 'do_not_contact')
      and lower(coalesce(q.bounce_status, 'clear')) not in ('bounced', 'complained', 'failed', 'suppressed')
      and not exists (
        select 1
        from public.gencouv_suppression_list sl
        where sl.organization_id = q.organization_id
          and sl.normalized_email = q.normalized_email
      )
      and not exists (
        select 1
        from public.gencouv_campaign_enrollments e
        where e.organization_id = q.organization_id
          and e.campaign_key = p_campaign_key
          and e.normalized_email = q.normalized_email
      )
    order by q.quality_score desc, q.created_at asc, q.id asc
    limit greatest(0, coalesce((select lead_limit from settings),0) - (select count(*) from pending_existing))
  ), inserted as (
    insert into public.gencouv_campaign_enrollments (
      organization_id,
      campaign_key,
      lead_id,
      normalized_email,
      cohort_date,
      campaign_status,
      validation_status,
      qualification_status,
      current_sequence_step,
      campaign_enrolled_at,
      last_event_at,
      suppression_status,
      unsubscribe_status,
      do_not_contact,
      metadata
    )
    select
      e.organization_id,
      p_campaign_key,
      e.id::text,
      e.normalized_email,
      ((now() at time zone 'America/New_York')::date),
      'pending_send',
      e.validation_status,
      e.qualification_status,
      0,
      now(),
      now(),
      'clear',
      'not_unsubscribed',
      false,
      jsonb_build_object(
        'prepared_by', 'gencouv_prepare_daily_enrollments',
        'source', e.source,
        'source_id', e.source_id,
        'raw_lead_id', e.raw_lead_id,
        'prepared_at', now()
      )
    from eligible e
    on conflict on constraint gencouv_campaign_enrollments_unique_active do nothing
    returning *
  ), updated as (
    update public.gencouv_qualified_leads q
    set campaign_status = 'enrolled',
        email_sequence_status = 'pending_send',
        campaign_enrolled_at = coalesce(q.campaign_enrolled_at, now()),
        last_event_at = now(),
        updated_at = now()
    from inserted i
    where q.id::text = i.lead_id
    returning q.id, i.id as enrollment_id
  ), prepared_new as (
    select
      i.id as enrollment_id,
      e.id as lead_id,
      e.normalized_email,
      e.email,
      e.first_name,
      e.last_name,
      e.full_name,
      e.product_interest,
      e.broker,
      i.cohort_date,
      i.campaign_status,
      e.quality_score,
      e.created_at
    from inserted i
    join eligible e on e.id::text = i.lead_id
    join updated u on u.enrollment_id = i.id
  )
  select
    r.enrollment_id,
    r.lead_id,
    r.normalized_email,
    r.email,
    r.first_name,
    r.last_name,
    r.full_name,
    r.product_interest,
    r.broker,
    r.cohort_date,
    r.campaign_status
  from (
    select * from pending_existing
    union all
    select * from prepared_new
  ) r
  order by r.quality_score desc, r.created_at asc, r.lead_id asc
  limit coalesce((select lead_limit from settings),0);
$function$;

revoke all on function public.gencouv_prepare_daily_enrollments(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.gencouv_prepare_daily_enrollments(uuid, text, integer) to service_role;

commit;
