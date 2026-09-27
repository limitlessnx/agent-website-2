do $$
begin
  alter table public.organization_memberships
    add constraint organization_memberships_organization_id_id_key
    unique (organization_id,id);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.appointment_calendar_resources
    drop constraint if exists appointment_calendar_resources_assigned_membership_id_fkey;
  alter table public.appointment_calendar_resources
    add constraint appointment_calendar_resources_assigned_membership_org_fkey
    foreign key (organization_id,assigned_membership_id)
    references public.organization_memberships(organization_id,id)
    on delete set null;
exception when duplicate_object then null;
end $$;

create index if not exists appointment_calendar_resources_staff_idx
  on public.appointment_calendar_resources(organization_id,assigned_membership_id,status);

create or replace function public.update_appointment_calendar_resource_settings(
  p_organization_id uuid,
  p_resource_id uuid,
  p_assigned_membership_id uuid default null,
  p_timezone text default null,
  p_default_duration_minutes integer default null,
  p_is_default boolean default null,
  p_status text default null,
  p_availability_configuration jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_resource public.appointment_calendar_resources%rowtype;
  v_timezone text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select * into v_resource
  from public.appointment_calendar_resources
  where organization_id=p_organization_id and id=p_resource_id
  for update;

  if not found then raise exception 'Calendar resource not found'; end if;

  if p_assigned_membership_id is not null and not exists(
    select 1
    from public.organization_memberships
    where organization_id=p_organization_id
      and id=p_assigned_membership_id
      and status='active'
  ) then
    raise exception 'Assigned staff member must be active in this organization';
  end if;

  if p_timezone is not null then
    select name into v_timezone
    from pg_catalog.pg_timezone_names
    where name=trim(p_timezone)
    limit 1;
    if v_timezone is null then
      raise exception 'Invalid timezone';
    end if;
  end if;

  if p_default_duration_minutes is not null
     and (p_default_duration_minutes < 5 or p_default_duration_minutes > 1440) then
    raise exception 'Default duration must be between 5 and 1440 minutes';
  end if;

  if p_status is not null and p_status not in ('active','paused','disabled') then
    raise exception 'Invalid calendar resource status';
  end if;

  if p_is_default is true then
    update public.appointment_calendar_resources
    set is_default=false,updated_at=now()
    where organization_id=p_organization_id
      and id<>p_resource_id
      and is_default=true;
  end if;

  update public.appointment_calendar_resources
  set
    assigned_membership_id=case
      when p_assigned_membership_id is distinct from assigned_membership_id then p_assigned_membership_id
      else assigned_membership_id
    end,
    timezone=coalesce(v_timezone,timezone),
    default_duration_minutes=coalesce(p_default_duration_minutes,default_duration_minutes),
    is_default=coalesce(p_is_default,is_default),
    status=coalesce(p_status,status),
    availability_configuration=coalesce(p_availability_configuration,availability_configuration),
    updated_at=now()
  where organization_id=p_organization_id and id=p_resource_id
  returning * into v_resource;

  return jsonb_build_object(
    'id',v_resource.id,
    'organization_id',v_resource.organization_id,
    'assigned_membership_id',v_resource.assigned_membership_id,
    'timezone',v_resource.timezone,
    'default_duration_minutes',v_resource.default_duration_minutes,
    'is_default',v_resource.is_default,
    'status',v_resource.status,
    'availability_configuration',v_resource.availability_configuration
  );
end
$$;

revoke all on function public.update_appointment_calendar_resource_settings(
  uuid,uuid,uuid,text,integer,boolean,text,jsonb
) from public,anon,authenticated;

grant execute on function public.update_appointment_calendar_resource_settings(
  uuid,uuid,uuid,text,integer,boolean,text,jsonb
) to service_role;
