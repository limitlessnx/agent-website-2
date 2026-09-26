create table if not exists public.system_event_contracts (
  event_type text primary key,
  contract_version integer not null default 1 check (contract_version > 0),
  category text not null,
  description text not null,
  required_payload_keys text[] not null default '{}'::text[],
  status text not null default 'active' check (status in ('active','deprecated','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.system_event_contracts enable row level security;
revoke all on public.system_event_contracts from anon,authenticated;
grant all on public.system_event_contracts to service_role;

insert into public.system_event_contracts(event_type,category,description,required_payload_keys)
values
 ('lead.created','lead','A new lead has been created.',array[]::text[]),
 ('lead.qualified','lead','A lead has been qualified for downstream action.',array[]::text[]),
 ('conversation.received','conversation','A customer conversation produced actionable intent.',array[]::text[]),
 ('appointment.requested','appointment','A customer requested an appointment.',array['requestedStart']),
 ('appointment.reschedule_requested','appointment','A confirmed appointment should be moved.',array['appointmentId','requestedStart']),
 ('appointment.cancel_requested','appointment','A confirmed appointment should be cancelled.',array['appointmentId']),
 ('appointment.email_required','appointment','The customer email required for a calendar invitation is missing.',array['appointmentId']),
 ('appointment.calendar_required','appointment','The tenant has no active calendar resource for appointment booking.',array['appointmentId']),
 ('appointment.slot_unavailable','appointment','The requested calendar slot is unavailable.',array['appointmentId','requestedStart','requestedEnd']),
 ('appointment.booked','appointment','An appointment was successfully booked.',array['appointmentId','startAt','endAt']),
 ('appointment.rescheduled','appointment','An appointment was rescheduled.',array['appointmentId','startAt','endAt']),
 ('appointment.cancelled','appointment','An appointment was cancelled.',array['appointmentId']),
 ('reminder.requested','follow_up','A reminder should be scheduled for a business event.',array['appointmentId']),
 ('reminder.scheduled','follow_up','A reminder was scheduled.',array['appointmentId']),
 ('handoff.requested','support','A human handoff was requested.',array[]::text[]),
 ('payment.requested','payment','A payment request was created.',array[]::text[]),
 ('payment.completed','payment','A payment was completed.',array[]::text[])
on conflict(event_type) do update set
 category=excluded.category,
 description=excluded.description,
 required_payload_keys=excluded.required_payload_keys,
 updated_at=now();

insert into public.system_event_route_templates(
  source_system_catalog_id,event_type,target_system_catalog_id,dispatch_mode,priority,configuration
)
select s.id,v.event_type,t.id,'workflow_adapter',v.priority,v.configuration
from (
  values
   ('whatsapp-agent','appointment.requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('email-automation','appointment.requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('support-agent','appointment.requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('outbound-call-agent','appointment.requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('whatsapp-agent','appointment.reschedule_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('email-automation','appointment.reschedule_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('support-agent','appointment.reschedule_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('outbound-call-agent','appointment.reschedule_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('whatsapp-agent','appointment.cancel_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('email-automation','appointment.cancel_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('support-agent','appointment.cancel_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('outbound-call-agent','appointment.cancel_requested','appointment-system',10,'{"adapter":"appointment"}'::jsonb),
   ('appointment-system','appointment.email_required','whatsapp-agent',10,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.email_required','email-automation',20,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.email_required','support-agent',30,'{"adapter":"agent_runtime"}'::jsonb),
   ('appointment-system','appointment.calendar_required','support-agent',10,'{"adapter":"support"}'::jsonb),
   ('appointment-system','appointment.slot_unavailable','whatsapp-agent',10,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.slot_unavailable','email-automation',20,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.booked','follow-up-system',10,'{"adapter":"follow_up"}'::jsonb),
   ('appointment-system','appointment.booked','whatsapp-agent',20,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.booked','email-automation',30,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.rescheduled','follow-up-system',10,'{"adapter":"follow_up"}'::jsonb),
   ('appointment-system','appointment.rescheduled','whatsapp-agent',20,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.rescheduled','email-automation',30,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.cancelled','follow-up-system',10,'{"adapter":"follow_up"}'::jsonb),
   ('appointment-system','appointment.cancelled','whatsapp-agent',20,'{"adapter":"channel_reply"}'::jsonb),
   ('appointment-system','appointment.cancelled','email-automation',30,'{"adapter":"channel_reply"}'::jsonb),
   ('follow-up-system','reminder.scheduled','whatsapp-agent',10,'{"adapter":"channel_reply"}'::jsonb),
   ('follow-up-system','reminder.scheduled','email-automation',20,'{"adapter":"channel_reply"}'::jsonb)
) as v(source_slug,event_type,target_slug,priority,configuration)
join public.system_catalog s on s.slug=v.source_slug
join public.system_catalog t on t.slug=v.target_slug
on conflict(source_system_catalog_id,event_type,target_system_catalog_id)
do update set dispatch_mode=excluded.dispatch_mode,priority=excluded.priority,configuration=excluded.configuration,status='active',updated_at=now();

create or replace function public.sync_system_routes_after_installation_change()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform public.sync_organization_system_event_routes(coalesce(new.organization_id,old.organization_id));
  return coalesce(new,old);
end
$$;
revoke all on function public.sync_system_routes_after_installation_change() from public,anon,authenticated;
grant execute on function public.sync_system_routes_after_installation_change() to service_role;

drop trigger if exists organization_system_sync_event_routes on public.organization_systems;
create trigger organization_system_sync_event_routes
after insert or update of status,system_id or delete
on public.organization_systems
for each row execute function public.sync_system_routes_after_installation_change();

do $$
declare v_org record;
begin
  for v_org in select id from public.organizations loop
    perform public.sync_organization_system_event_routes(v_org.id);
  end loop;
end $$;

create table if not exists public.appointment_calendar_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null,
  provider text not null,
  external_calendar_id text not null,
  display_name text not null,
  organizer_email text,
  assigned_membership_id uuid references public.organization_memberships(id) on delete set null,
  timezone text not null default 'Africa/Lagos',
  default_duration_minutes integer not null default 60 check(default_duration_minutes between 5 and 1440),
  is_default boolean not null default false,
  status text not null default 'active' check(status in ('active','paused','disabled')),
  availability_configuration jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id),
  unique(organization_id,integration_id,external_calendar_id),
  foreign key (organization_id,integration_id)
    references public.organization_integrations(organization_id,id) on delete cascade
);

create unique index if not exists appointment_calendar_resources_default_uidx
  on public.appointment_calendar_resources(organization_id)
  where is_default=true and status='active';

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  conversation_id uuid,
  source_system_id uuid,
  appointment_system_id uuid not null,
  calendar_resource_id uuid,
  source_event_id uuid references public.domain_events(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  status text not null default 'requested'
    check(status in ('requested','email_required','calendar_required','pending_availability','confirmed','rescheduled','cancelled','failed')),
  title text not null default 'Appointment',
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'Africa/Lagos',
  customer_name text,
  customer_email text,
  customer_phone text,
  organizer_email text,
  provider text,
  external_calendar_id text,
  external_event_id text,
  external_html_link text,
  location text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id),
  unique(organization_id,source_event_id),
  foreign key (organization_id,customer_id)
    references public.crm_customers(organization_id,id) on delete cascade,
  foreign key (organization_id,conversation_id)
    references public.crm_conversations(organization_id,id) on delete set null,
  foreign key (organization_id,source_system_id)
    references public.organization_systems(organization_id,id) on delete set null,
  foreign key (organization_id,appointment_system_id)
    references public.organization_systems(organization_id,id) on delete restrict,
  foreign key (organization_id,calendar_resource_id)
    references public.appointment_calendar_resources(organization_id,id) on delete set null
);

create index if not exists appointments_org_status_start_idx on public.appointments(organization_id,status,start_at);
create index if not exists appointments_org_customer_idx on public.appointments(organization_id,customer_id,created_at desc);
create index if not exists appointments_org_correlation_idx on public.appointments(organization_id,correlation_id,created_at);

alter table public.appointment_calendar_resources enable row level security;
alter table public.appointments enable row level security;
revoke all on public.appointment_calendar_resources,public.appointments from anon,authenticated;
grant select on public.appointment_calendar_resources,public.appointments to authenticated;
grant all on public.appointment_calendar_resources,public.appointments to service_role;

create policy appointment_calendar_resources_select on public.appointment_calendar_resources
for select to authenticated
using (
  public.has_organization_permission(organization_id,'appointments.view')
  or public.has_organization_permission(organization_id,'appointments.manage')
  or public.has_organization_permission(organization_id,'integrations.view')
  or public.has_organization_permission(organization_id,'integrations.manage')
);

create policy appointments_select on public.appointments
for select to authenticated
using (
  public.has_organization_permission(organization_id,'appointments.view')
  or public.has_organization_permission(organization_id,'appointments.manage')
);

create or replace function public.upsert_appointment_calendar_resource(
  p_organization_id uuid,p_integration_id uuid,p_provider text,p_external_calendar_id text,p_display_name text,
  p_organizer_email text default null,p_timezone text default 'Africa/Lagos',
  p_default_duration_minutes integer default 60,p_is_default boolean default false,
  p_availability_configuration jsonb default '{}'::jsonb,p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_resource_id uuid;
begin
  if not exists(
    select 1 from public.organization_integrations i
    where i.organization_id=p_organization_id and i.id=p_integration_id
      and i.status in ('configured','connected','degraded')
  ) then raise exception 'Active calendar integration not found for organization'; end if;
  if p_is_default then
    update public.appointment_calendar_resources set is_default=false,updated_at=now()
    where organization_id=p_organization_id and is_default=true;
  end if;
  insert into public.appointment_calendar_resources(
    organization_id,integration_id,provider,external_calendar_id,display_name,organizer_email,
    timezone,default_duration_minutes,is_default,status,availability_configuration,metadata
  ) values (
    p_organization_id,p_integration_id,trim(p_provider),trim(p_external_calendar_id),trim(p_display_name),
    nullif(trim(coalesce(p_organizer_email,'')),''),coalesce(nullif(trim(p_timezone),''),'Africa/Lagos'),
    p_default_duration_minutes,p_is_default,'active',coalesce(p_availability_configuration,'{}'::jsonb),
    coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(organization_id,integration_id,external_calendar_id)
  do update set provider=excluded.provider,display_name=excluded.display_name,organizer_email=excluded.organizer_email,
    timezone=excluded.timezone,default_duration_minutes=excluded.default_duration_minutes,is_default=excluded.is_default,
    status='active',availability_configuration=excluded.availability_configuration,metadata=excluded.metadata,updated_at=now()
  returning id into v_resource_id;
  return v_resource_id;
end
$$;
revoke all on function public.upsert_appointment_calendar_resource(uuid,uuid,text,text,text,text,text,integer,boolean,jsonb,jsonb)
from public,anon,authenticated;
grant execute on function public.upsert_appointment_calendar_resource(uuid,uuid,text,text,text,text,text,integer,boolean,jsonb,jsonb)
to service_role;
