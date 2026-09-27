alter table public.appointment_calendar_resources
  add column if not exists service_keys text[] not null default '{}'::text[],
  add column if not exists branch_key text,
  add column if not exists department_key text,
  add column if not exists routing_priority integer not null default 100;

alter table public.appointment_calendar_resources
  drop constraint if exists appointment_calendar_resources_routing_priority_check;
alter table public.appointment_calendar_resources
  add constraint appointment_calendar_resources_routing_priority_check
  check (routing_priority between 0 and 10000);

create index if not exists appointment_calendar_resources_routing_idx
  on public.appointment_calendar_resources(
    organization_id,status,branch_key,department_key,routing_priority
  );

create index if not exists appointment_calendar_resources_service_keys_gin
  on public.appointment_calendar_resources using gin(service_keys);

create table if not exists public.appointment_routing_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  strategy text not null default 'default'
    check(strategy in ('default','least_busy','round_robin')),
  fallback_to_default boolean not null default true,
  lookahead_days integer not null default 30
    check(lookahead_days between 1 and 365),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_routing_state (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  routing_key text not null,
  last_resource_id uuid,
  cursor bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key(organization_id,routing_key),
  foreign key(organization_id,last_resource_id)
    references public.appointment_calendar_resources(organization_id,id)
    on delete set null (last_resource_id)
);

alter table public.appointment_routing_settings enable row level security;
alter table public.appointment_routing_state enable row level security;

revoke all on public.appointment_routing_settings,public.appointment_routing_state
from anon,authenticated;
grant select on public.appointment_routing_settings to authenticated;
grant all on public.appointment_routing_settings,public.appointment_routing_state to service_role;

create policy appointment_routing_settings_select
on public.appointment_routing_settings
for select to authenticated
using(
  public.has_organization_permission(organization_id,'appointments.view')
  or public.has_organization_permission(organization_id,'appointments.manage')
  or public.has_organization_permission(organization_id,'integrations.view')
  or public.has_organization_permission(organization_id,'integrations.manage')
);

create or replace function public.update_appointment_resource_scheduling_policy(
  p_organization_id uuid,
  p_resource_id uuid,
  p_availability_configuration jsonb,
  p_service_keys text[] default '{}'::text[],
  p_branch_key text default null,
  p_department_key text default null,
  p_routing_priority integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_resource public.appointment_calendar_resources%rowtype;
  v_config jsonb:=coalesce(p_availability_configuration,'{}'::jsonb);
begin
  if auth.role()<>'service_role' then raise exception 'service_role required'; end if;

  select * into v_resource
  from public.appointment_calendar_resources
  where organization_id=p_organization_id and id=p_resource_id
  for update;
  if not found then raise exception 'Calendar resource not found'; end if;

  if p_routing_priority<0 or p_routing_priority>10000 then
    raise exception 'Routing priority must be between 0 and 10000';
  end if;

  if coalesce((v_config->>'minimumNoticeMinutes')::integer,0)<0
     or coalesce((v_config->>'minimumNoticeMinutes')::integer,0)>10080 then
    raise exception 'Minimum notice must be between 0 and 10080 minutes';
  end if;

  if coalesce((v_config->>'maximumAdvanceDays')::integer,30)<1
     or coalesce((v_config->>'maximumAdvanceDays')::integer,30)>365 then
    raise exception 'Maximum advance days must be between 1 and 365';
  end if;

  if coalesce((v_config->>'bufferBeforeMinutes')::integer,0)<0
     or coalesce((v_config->>'bufferBeforeMinutes')::integer,0)>1440
     or coalesce((v_config->>'bufferAfterMinutes')::integer,0)<0
     or coalesce((v_config->>'bufferAfterMinutes')::integer,0)>1440 then
    raise exception 'Appointment buffers must be between 0 and 1440 minutes';
  end if;

  update public.appointment_calendar_resources
  set
    availability_configuration=v_config,
    service_keys=coalesce(
      array(
        select distinct lower(trim(value))
        from unnest(coalesce(p_service_keys,'{}'::text[])) value
        where nullif(trim(value),'') is not null
      ),
      '{}'::text[]
    ),
    branch_key=nullif(lower(trim(coalesce(p_branch_key,''))),''),
    department_key=nullif(lower(trim(coalesce(p_department_key,''))),''),
    routing_priority=p_routing_priority,
    updated_at=now()
  where organization_id=p_organization_id and id=p_resource_id
  returning * into v_resource;

  return jsonb_build_object(
    'id',v_resource.id,
    'availability_configuration',v_resource.availability_configuration,
    'service_keys',v_resource.service_keys,
    'branch_key',v_resource.branch_key,
    'department_key',v_resource.department_key,
    'routing_priority',v_resource.routing_priority
  );
end
$$;

revoke all on function public.update_appointment_resource_scheduling_policy(
  uuid,uuid,jsonb,text[],text,text,integer
) from public,anon,authenticated;
grant execute on function public.update_appointment_resource_scheduling_policy(
  uuid,uuid,jsonb,text[],text,text,integer
) to service_role;

create or replace function public.set_appointment_routing_settings(
  p_organization_id uuid,
  p_strategy text,
  p_fallback_to_default boolean default true,
  p_lookahead_days integer default 30,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v public.appointment_routing_settings%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role required'; end if;
  if p_strategy not in ('default','least_busy','round_robin') then
    raise exception 'Invalid appointment routing strategy';
  end if;
  if p_lookahead_days<1 or p_lookahead_days>365 then
    raise exception 'Routing lookahead must be between 1 and 365 days';
  end if;

  insert into public.appointment_routing_settings(
    organization_id,strategy,fallback_to_default,lookahead_days,metadata
  ) values(
    p_organization_id,p_strategy,p_fallback_to_default,p_lookahead_days,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(organization_id) do update set
    strategy=excluded.strategy,
    fallback_to_default=excluded.fallback_to_default,
    lookahead_days=excluded.lookahead_days,
    metadata=excluded.metadata,
    updated_at=now()
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.set_appointment_routing_settings(uuid,text,boolean,integer,jsonb)
from public,anon,authenticated;
grant execute on function public.set_appointment_routing_settings(uuid,text,boolean,integer,jsonb)
to service_role;

create or replace function public.advance_appointment_round_robin(
  p_organization_id uuid,
  p_routing_key text,
  p_resource_id uuid
)
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare v_cursor bigint;
begin
  if auth.role()<>'service_role' then raise exception 'service_role required'; end if;

  if not exists(
    select 1 from public.appointment_calendar_resources
    where organization_id=p_organization_id and id=p_resource_id and status='active'
  ) then
    raise exception 'Round-robin resource is not active in this organization';
  end if;

  insert into public.appointment_routing_state(
    organization_id,routing_key,last_resource_id,cursor
  ) values(
    p_organization_id,lower(trim(p_routing_key)),p_resource_id,1
  )
  on conflict(organization_id,routing_key) do update set
    last_resource_id=excluded.last_resource_id,
    cursor=public.appointment_routing_state.cursor+1,
    updated_at=now()
  returning cursor into v_cursor;

  return v_cursor;
end
$$;

revoke all on function public.advance_appointment_round_robin(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function public.advance_appointment_round_robin(uuid,text,uuid)
to service_role;
