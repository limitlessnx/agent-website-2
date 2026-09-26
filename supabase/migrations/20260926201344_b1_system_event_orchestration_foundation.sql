alter table public.organization_systems
  add constraint organization_systems_org_id_id_key unique (organization_id, id);

alter table public.domain_events
  add column if not exists correlation_id uuid,
  add column if not exists causation_id uuid,
  add column if not exists source_system_id uuid,
  add column if not exists target_system_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists conversation_id uuid,
  add column if not exists idempotency_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.domain_events
set correlation_id = coalesce(correlation_id, request_id)
where correlation_id is null;

alter table public.domain_events
  alter column correlation_id set not null,
  alter column correlation_id set default gen_random_uuid();

do $$ begin
  alter table public.domain_events
    add constraint domain_events_source_system_tenant_fk
    foreign key (organization_id, source_system_id)
    references public.organization_systems(organization_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.domain_events
    add constraint domain_events_target_system_tenant_fk
    foreign key (organization_id, target_system_id)
    references public.organization_systems(organization_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.domain_events
    add constraint domain_events_customer_tenant_fk
    foreign key (organization_id, customer_id)
    references public.crm_customers(organization_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.domain_events
    add constraint domain_events_conversation_tenant_fk
    foreign key (organization_id, conversation_id)
    references public.crm_conversations(organization_id, id)
    on delete set null;
exception when duplicate_object then null; end $$;

create unique index if not exists domain_events_org_idempotency_uidx
  on public.domain_events(organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists domain_events_org_correlation_idx
  on public.domain_events(organization_id, correlation_id, created_at);

create table if not exists public.system_event_routes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_system_id uuid not null,
  event_type text not null,
  target_system_id uuid not null,
  status text not null default 'active' check (status in ('active','paused','disabled')),
  priority integer not null default 100 check (priority between 1 and 1000),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_system_id, event_type, target_system_id),
  foreign key (organization_id, source_system_id)
    references public.organization_systems(organization_id, id) on delete cascade,
  foreign key (organization_id, target_system_id)
    references public.organization_systems(organization_id, id) on delete cascade
);

create table if not exists public.system_event_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.domain_events(id) on delete cascade,
  route_id uuid not null references public.system_event_routes(id) on delete cascade,
  target_system_id uuid not null,
  status text not null default 'pending' check (status in ('pending','processing','delivered','failed','skipped')),
  attempt integer not null default 1 check (attempt > 0),
  trigger_run_id text,
  result jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, route_id, attempt),
  foreign key (organization_id, target_system_id)
    references public.organization_systems(organization_id, id) on delete cascade
);

create index if not exists system_event_routes_lookup_idx
  on public.system_event_routes(organization_id, source_system_id, event_type, status, priority);

create index if not exists system_event_deliveries_event_idx
  on public.system_event_deliveries(organization_id, event_id, status, created_at);

alter table public.system_event_routes enable row level security;
alter table public.system_event_deliveries enable row level security;

revoke all on public.system_event_routes, public.system_event_deliveries from anon, authenticated;

create or replace function public.publish_system_event(
  p_organization_id uuid,
  p_source_system_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_target_system_id uuid default null,
  p_customer_id uuid default null,
  p_conversation_id uuid default null,
  p_correlation_id uuid default null,
  p_causation_id uuid default null,
  p_idempotency_key text default null,
  p_source text default 'system'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_source_catalog_id uuid;
  v_target_catalog_id uuid;
begin
  if coalesce(trim(p_event_type),'') = '' then raise exception 'event_type is required'; end if;
  if coalesce(trim(p_source),'') = '' then raise exception 'source is required'; end if;

  select os.system_id into v_source_catalog_id
  from public.organization_systems os
  where os.organization_id=p_organization_id
    and os.id=p_source_system_id
    and os.status='active';
  if v_source_catalog_id is null then
    raise exception 'Source system is not active in organization';
  end if;
  if not public.organization_can_use_system(p_organization_id,v_source_catalog_id) then
    raise exception 'Source system is not entitled for organization';
  end if;

  if p_target_system_id is not null then
    select os.system_id into v_target_catalog_id
    from public.organization_systems os
    where os.organization_id=p_organization_id
      and os.id=p_target_system_id
      and os.status='active';
    if v_target_catalog_id is null then
      raise exception 'Target system is not active in organization';
    end if;
    if not public.organization_can_use_system(p_organization_id,v_target_catalog_id) then
      raise exception 'Target system is not entitled for organization';
    end if;
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.crm_customers c
    where c.organization_id=p_organization_id and c.id=p_customer_id
  ) then raise exception 'Customer does not belong to organization'; end if;

  if p_conversation_id is not null and not exists (
    select 1 from public.crm_conversations c
    where c.organization_id=p_organization_id and c.id=p_conversation_id
  ) then raise exception 'Conversation does not belong to organization'; end if;

  if p_idempotency_key is not null then
    select id into v_event_id
    from public.domain_events
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key
    limit 1;
    if v_event_id is not null then return v_event_id; end if;
  end if;

  insert into public.domain_events(
    organization_id, source_system_id, target_system_id, customer_id, conversation_id,
    correlation_id, causation_id, event_type, source, payload, status, idempotency_key, metadata
  ) values (
    p_organization_id, p_source_system_id, p_target_system_id, p_customer_id, p_conversation_id,
    coalesce(p_correlation_id,gen_random_uuid()), p_causation_id, trim(p_event_type), trim(p_source),
    coalesce(p_payload,'{}'::jsonb), 'pending', nullif(trim(coalesce(p_idempotency_key,'')),''),
    jsonb_build_object('contract_version','1')
  )
  returning id into v_event_id;

  return v_event_id;
end $$;

revoke all on function public.publish_system_event(uuid,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,text,text)
from public, anon, authenticated;
grant execute on function public.publish_system_event(uuid,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,text,text)
to service_role;

create or replace function public.claim_system_event(
  p_event_id uuid default null
) returns public.domain_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.domain_events%rowtype;
begin
  select * into v_event
  from public.domain_events
  where status='pending'
    and available_at <= now()
    and (p_event_id is null or id=p_event_id)
  order by created_at
  for update skip locked
  limit 1;

  if not found then return null; end if;

  update public.domain_events
  set status='processing', attempts=attempts+1, updated_at=now()
  where id=v_event.id
  returning * into v_event;

  return v_event;
end $$;

revoke all on function public.claim_system_event(uuid) from public, anon, authenticated;
grant execute on function public.claim_system_event(uuid) to service_role;
