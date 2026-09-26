create table if not exists public.channel_inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null,
  source_system_id uuid not null,
  channel text not null,
  provider text not null,
  external_event_id text not null,
  external_conversation_id text,
  customer_id uuid,
  customer_phone text,
  customer_name text,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0,
  processing_started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel, provider, external_event_id),
  foreign key (organization_id, agent_id) references public.agents(organization_id, id) on delete cascade,
  foreign key (organization_id, source_system_id) references public.organization_systems(organization_id, id) on delete cascade,
  foreign key (organization_id, customer_id) references public.crm_customers(organization_id, id) on delete set null
);
create index if not exists channel_inbound_events_status_idx on public.channel_inbound_events(organization_id,status,created_at);
alter table public.channel_inbound_events enable row level security;
revoke all on public.channel_inbound_events from anon,authenticated;
create or replace function public.claim_channel_inbound_event(
  p_organization_id uuid,p_agent_id uuid,p_source_system_id uuid,p_channel text,p_provider text,
  p_external_event_id text,p_external_conversation_id text,p_customer_id uuid,p_customer_phone text,
  p_customer_name text,p_message text,p_payload jsonb default '{}'::jsonb
) returns public.channel_inbound_events
language plpgsql security definer set search_path=''
as $$
declare v_event public.channel_inbound_events%rowtype;
begin
  if coalesce(trim(p_external_event_id),'')='' then raise exception 'external_event_id is required'; end if;
  if coalesce(trim(p_message),'')='' then raise exception 'message is required'; end if;
  if not exists(select 1 from public.agents where organization_id=p_organization_id and id=p_agent_id and status in ('published','active','testing')) then raise exception 'Agent is not active in organization'; end if;
  if not exists(select 1 from public.organization_systems where organization_id=p_organization_id and id=p_source_system_id and status='active') then raise exception 'Source system is not active in organization'; end if;
  insert into public.channel_inbound_events(
    organization_id,agent_id,source_system_id,channel,provider,external_event_id,external_conversation_id,
    customer_id,customer_phone,customer_name,message,payload,status,attempts,processing_started_at
  ) values (
    p_organization_id,p_agent_id,p_source_system_id,trim(p_channel),trim(p_provider),trim(p_external_event_id),
    nullif(trim(coalesce(p_external_conversation_id,'')),''),p_customer_id,
    nullif(trim(coalesce(p_customer_phone,'')),''),nullif(trim(coalesce(p_customer_name,'')),''),
    p_message,coalesce(p_payload,'{}'::jsonb),'processing',1,now()
  )
  on conflict (organization_id,channel,provider,external_event_id)
  do update set
    attempts=public.channel_inbound_events.attempts+1,
    status=case when public.channel_inbound_events.status='completed' then 'completed' else 'processing' end,
    processing_started_at=case when public.channel_inbound_events.status='completed' then public.channel_inbound_events.processing_started_at else now() end,
    last_error=case when public.channel_inbound_events.status='completed' then public.channel_inbound_events.last_error else null end,
    updated_at=now()
  returning * into v_event;
  return v_event;
end $$;
revoke all on function public.claim_channel_inbound_event(uuid,uuid,uuid,text,text,text,text,uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_channel_inbound_event(uuid,uuid,uuid,text,text,text,text,uuid,text,text,text,jsonb) to service_role;
