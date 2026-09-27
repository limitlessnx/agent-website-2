create table if not exists public.appointment_availability_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'Africa/Lagos',
  availability_configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointment_availability_settings enable row level security;

revoke all on public.appointment_availability_settings from anon,authenticated;
grant select on public.appointment_availability_settings to authenticated;
grant all on public.appointment_availability_settings to service_role;

create policy appointment_availability_settings_select
on public.appointment_availability_settings
for select to authenticated
using(
  public.has_organization_permission(organization_id,'appointments.view')
  or public.has_organization_permission(organization_id,'appointments.manage')
  or public.has_organization_permission(organization_id,'integrations.view')
  or public.has_organization_permission(organization_id,'integrations.manage')
);

create or replace function public.set_appointment_availability_settings(
  p_organization_id uuid,
  p_timezone text,
  p_availability_configuration jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_timezone text;
  v_config jsonb:=coalesce(p_availability_configuration,'{}'::jsonb);
  v public.appointment_availability_settings%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role required'; end if;
  select name into v_timezone from pg_catalog.pg_timezone_names where name=trim(p_timezone) limit 1;
  if v_timezone is null then raise exception 'Invalid timezone'; end if;
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

  insert into public.appointment_availability_settings(
    organization_id,timezone,availability_configuration
  ) values(
    p_organization_id,v_timezone,v_config
  )
  on conflict(organization_id) do update set
    timezone=excluded.timezone,
    availability_configuration=excluded.availability_configuration,
    updated_at=now()
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.set_appointment_availability_settings(uuid,text,jsonb)
from public,anon,authenticated;
grant execute on function public.set_appointment_availability_settings(uuid,text,jsonb)
to service_role;
