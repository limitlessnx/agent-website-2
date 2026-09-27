create table if not exists public.customer_identifiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  identifier_type text not null check(identifier_type in ('email','phone','whatsapp','external','web_session','voice','telegram')),
  normalized_value text not null,
  provider text,
  verified boolean not null default false,
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,identifier_type,normalized_value),
  foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade
);

create index if not exists customer_identifiers_customer_idx
  on public.customer_identifiers(organization_id,customer_id,identifier_type);

create table if not exists public.customer_identity_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  identifier_type text not null,
  normalized_value text not null,
  customer_ids uuid[] not null,
  status text not null default 'open' check(status in ('open','resolved','dismissed')),
  reason text not null,
  resolution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.customer_timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  conversation_id uuid,
  event_type text not null,
  channel text,
  title text not null,
  summary text,
  occurred_at timestamptz not null default now(),
  source_table text,
  source_id uuid,
  correlation_id uuid,
  actor_type text,
  actor_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
  foreign key(organization_id,conversation_id) references public.crm_conversations(organization_id,id) on delete set null
);

create unique index if not exists customer_timeline_source_uidx
  on public.customer_timeline_events(organization_id,source_table,source_id,event_type)
  where source_table is not null and source_id is not null;
create index if not exists customer_timeline_customer_time_idx
  on public.customer_timeline_events(organization_id,customer_id,occurred_at desc);

alter table public.customer_identifiers enable row level security;
alter table public.customer_identity_conflicts enable row level security;
alter table public.customer_timeline_events enable row level security;

revoke all on public.customer_identifiers,public.customer_identity_conflicts,public.customer_timeline_events from anon,authenticated;
grant select on public.customer_identifiers,public.customer_timeline_events to authenticated;
grant all on public.customer_identifiers,public.customer_identity_conflicts,public.customer_timeline_events to service_role;

create policy customer_identifiers_select on public.customer_identifiers for select to authenticated
using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));

create policy customer_timeline_select on public.customer_timeline_events for select to authenticated
using(public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));

create or replace function public.normalize_customer_identifier(p_type text,p_value text)
returns text language plpgsql immutable security invoker set search_path=''
as $$
declare v text:=lower(trim(coalesce(p_value,'')));
begin
  if v='' then return null; end if;
  if p_type='email' then return v; end if;
  if p_type in ('phone','whatsapp','voice') then
    v:=regexp_replace(v,'[^0-9+]','','g');
    if left(v,2)='00' then v:='+'||substr(v,3); end if;
    return v;
  end if;
  return trim(coalesce(p_value,''));
end $$;

create or replace function public.resolve_crm_customer(
  p_organization_id uuid,p_email text default null,p_phone text default null,p_external_key text default null,
  p_full_name text default null,p_company_name text default null,p_source text default 'runtime'
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_email text:=public.normalize_customer_identifier('email',p_email);
  v_phone text:=public.normalize_customer_identifier('phone',p_phone);
  v_external text:=public.normalize_customer_identifier('external',p_external_key);
  v_ids uuid[]:='{}'::uuid[]; v_customer uuid; v_conflict uuid;
begin
  select coalesce(array_agg(distinct customer_id),'{}'::uuid[]) into v_ids
  from public.customer_identifiers
  where organization_id=p_organization_id and (
    (v_email is not null and identifier_type='email' and normalized_value=v_email) or
    (v_phone is not null and identifier_type in ('phone','whatsapp') and normalized_value=v_phone) or
    (v_external is not null and identifier_type='external' and normalized_value=v_external)
  );

  if cardinality(v_ids)>1 then
    insert into public.customer_identity_conflicts(organization_id,identifier_type,normalized_value,customer_ids,reason)
    values(p_organization_id,'external',coalesce(v_external,v_email,v_phone,'unknown'),v_ids,'Provided identifiers resolve to different customers')
    returning id into v_conflict;
    return jsonb_build_object('status','conflict','conflict_id',v_conflict,'customer_ids',v_ids);
  end if;

  if cardinality(v_ids)=1 then
    v_customer:=v_ids[1];
    update public.crm_customers set
      full_name=coalesce(nullif(trim(p_full_name),''),full_name),
      email=coalesce(v_email,email),phone=coalesce(v_phone,phone),
      company_name=coalesce(nullif(trim(p_company_name),''),company_name),updated_at=now()
    where organization_id=p_organization_id and id=v_customer;
  else
    insert into public.crm_customers(organization_id,external_key,full_name,email,phone,company_name,status,metadata)
    values(p_organization_id,v_external,nullif(trim(p_full_name),''),v_email,v_phone,nullif(trim(p_company_name),''),'active',jsonb_build_object('created_by',p_source))
    returning id into v_customer;
  end if;

  if v_email is not null then
    insert into public.customer_identifiers(organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata)
    values(p_organization_id,v_customer,'email',v_email,true,jsonb_build_object('source',p_source))
    on conflict(organization_id,identifier_type,normalized_value) do update set customer_id=excluded.customer_id,updated_at=now();
  end if;
  if v_phone is not null then
    insert into public.customer_identifiers(organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata)
    values(p_organization_id,v_customer,'phone',v_phone,true,jsonb_build_object('source',p_source))
    on conflict(organization_id,identifier_type,normalized_value) do update set customer_id=excluded.customer_id,updated_at=now();
  end if;
  if v_external is not null then
    insert into public.customer_identifiers(organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata)
    values(p_organization_id,v_customer,'external',v_external,true,jsonb_build_object('source',p_source))
    on conflict(organization_id,identifier_type,normalized_value) do update set customer_id=excluded.customer_id,updated_at=now();
  end if;

  return jsonb_build_object('status',case when cardinality(v_ids)=1 then 'matched' else 'created' end,'customer_id',v_customer);
end $$;

revoke all on function public.resolve_crm_customer(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.resolve_crm_customer(uuid,text,text,text,text,text,text) to service_role;

create or replace function public.get_or_create_crm_conversation(
  p_organization_id uuid,p_customer_id uuid,p_channel text,p_external_thread_id text default null,
  p_agent_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.crm_customers where organization_id=p_organization_id and id=p_customer_id)
  then raise exception 'Customer does not belong to organization'; end if;
  if p_external_thread_id is not null then
    select id into v_id from public.crm_conversations
    where organization_id=p_organization_id and channel=p_channel and external_thread_id=p_external_thread_id
    order by created_at desc limit 1;
  end if;
  if v_id is null then
    insert into public.crm_conversations(organization_id,customer_id,agent_id,channel,external_thread_id,status,metadata)
    values(p_organization_id,p_customer_id,p_agent_id,p_channel,p_external_thread_id,'open',coalesce(p_metadata,'{}'::jsonb))
    returning id into v_id;
  else
    update public.crm_conversations set customer_id=p_customer_id,agent_id=coalesce(p_agent_id,agent_id),
      metadata=coalesce(metadata,'{}'::jsonb)||coalesce(p_metadata,'{}'::jsonb),updated_at=now()
    where id=v_id and organization_id=p_organization_id;
  end if;
  return v_id;
end $$;

revoke all on function public.get_or_create_crm_conversation(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_or_create_crm_conversation(uuid,uuid,text,text,uuid,jsonb) to service_role;

create or replace function public.add_customer_timeline_event(
 p_organization_id uuid,p_customer_id uuid,p_event_type text,p_title text,p_summary text default null,
 p_channel text default null,p_conversation_id uuid default null,p_source_table text default null,
 p_source_id uuid default null,p_correlation_id uuid default null,p_actor_type text default null,
 p_actor_id text default null,p_metadata jsonb default '{}'::jsonb,p_occurred_at timestamptz default now()
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 insert into public.customer_timeline_events(
  organization_id,customer_id,conversation_id,event_type,channel,title,summary,occurred_at,
  source_table,source_id,correlation_id,actor_type,actor_id,metadata
 ) values (
  p_organization_id,p_customer_id,p_conversation_id,p_event_type,p_channel,p_title,p_summary,p_occurred_at,
  p_source_table,p_source_id,p_correlation_id,p_actor_type,p_actor_id,coalesce(p_metadata,'{}'::jsonb)
 )
 on conflict(organization_id,source_table,source_id,event_type) where source_table is not null and source_id is not null
 do update set summary=excluded.summary,metadata=excluded.metadata,occurred_at=excluded.occurred_at
 returning id into v_id;
 return v_id;
end $$;

revoke all on function public.add_customer_timeline_event(uuid,uuid,text,text,text,text,uuid,text,uuid,uuid,text,text,jsonb,timestamptz)
from public,anon,authenticated;
grant execute on function public.add_customer_timeline_event(uuid,uuid,text,text,text,text,uuid,text,uuid,uuid,text,text,jsonb,timestamptz)
to service_role;

create or replace function public.timeline_from_crm_message() returns trigger
language plpgsql security definer set search_path=''
as $$
declare v_customer uuid; v_channel text;
begin
 select customer_id,channel into v_customer,v_channel from public.crm_conversations
 where organization_id=new.organization_id and id=new.conversation_id;
 if v_customer is not null then
   perform public.add_customer_timeline_event(
     new.organization_id,v_customer,'message.'||new.direction,
     case when new.direction='inbound' then 'Customer message' when new.direction='outbound' then 'Business reply' else 'Internal message' end,
     left(coalesce(new.content,''),500),v_channel,new.conversation_id,'crm_messages',new.id,null,new.sender_type,
     coalesce(new.agent_id::text,null),jsonb_build_object('content_type',new.content_type,'status',new.status),new.created_at
   );
 end if;
 return new;
end $$;

drop trigger if exists crm_message_customer_timeline on public.crm_messages;
create trigger crm_message_customer_timeline after insert on public.crm_messages
for each row execute function public.timeline_from_crm_message();

create or replace function public.timeline_from_appointment() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
 perform public.add_customer_timeline_event(
   new.organization_id,new.customer_id,'appointment.'||new.status,'Appointment '||replace(new.status,'_',' '),
   new.title,'appointment',new.conversation_id,'appointments',new.id,new.correlation_id,'system',new.appointment_system_id::text,
   jsonb_build_object('start_at',new.start_at,'end_at',new.end_at,'provider',new.provider,'external_event_id',new.external_event_id),new.updated_at
 );
 return new;
end $$;

drop trigger if exists appointment_customer_timeline on public.appointments;
create trigger appointment_customer_timeline after insert or update of status,start_at,end_at on public.appointments
for each row execute function public.timeline_from_appointment();

alter table public.leo_public_leads add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.leo_public_leads add column if not exists customer_id uuid;
alter table public.leo_public_leads add column if not exists conversation_id uuid;
alter table public.evaluation_leads add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.evaluation_leads add column if not exists customer_id uuid;
alter table public.evaluation_leads add column if not exists conversation_id uuid;

do $$ begin alter table public.leo_public_leads add constraint leo_public_leads_customer_tenant_fk
foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin alter table public.leo_public_leads add constraint leo_public_leads_conversation_tenant_fk
foreign key(organization_id,conversation_id) references public.crm_conversations(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin alter table public.evaluation_leads add constraint evaluation_leads_customer_tenant_fk
foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin alter table public.evaluation_leads add constraint evaluation_leads_conversation_tenant_fk
foreign key(organization_id,conversation_id) references public.crm_conversations(organization_id,id) on delete set null;
exception when duplicate_object then null; end $$;
