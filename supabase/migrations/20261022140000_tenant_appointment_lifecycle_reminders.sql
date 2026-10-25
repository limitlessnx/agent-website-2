create table if not exists public.tenant_appointment_reminders (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 appointment_id uuid not null,
 reminder_offset_minutes integer not null check (reminder_offset_minutes > 0),
 scheduled_for timestamptz not null,
 channel text not null default 'internal' check (channel in ('internal','whatsapp','email')),
 status text not null default 'queued' check (status in ('queued','processing','sent','delivered','failed','blocked','cancelled')),
 attempt_count integer not null default 0,
 last_error text,
 result jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
	 foreign key (organization_id, appointment_id) references public.appointments(organization_id,id) on delete cascade,
	 unique (organization_id, appointment_id, reminder_offset_minutes),
	 unique (organization_id, id)
	);
create index if not exists tenant_appointment_reminders_due_idx on public.tenant_appointment_reminders(status,scheduled_for) where status='queued';
alter table public.tenant_appointment_reminders enable row level security;
revoke all on public.tenant_appointment_reminders from public,anon,authenticated;
grant all on public.tenant_appointment_reminders to service_role;

create or replace function public.sync_tenant_appointment_reminders()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.status in ('confirmed','rescheduled') and new.start_at is not null and new.end_at is not null and new.start_at > now() then
  update public.tenant_appointment_reminders set status='cancelled',updated_at=now(),last_error='Appointment changed; schedule refreshed.'
   where organization_id=new.organization_id and appointment_id=new.id and status in ('queued','failed');
  insert into public.tenant_appointment_reminders(organization_id,appointment_id,reminder_offset_minutes,scheduled_for,channel)
  values (new.organization_id,new.id,1440,new.start_at-interval '24 hours','internal'),
         (new.organization_id,new.id,120,new.start_at-interval '2 hours','internal')
  on conflict (organization_id,appointment_id,reminder_offset_minutes) do update
   set scheduled_for=excluded.scheduled_for,status='queued',channel='internal',last_error=null,updated_at=now()
   where public.tenant_appointment_reminders.status in ('queued','failed','cancelled');
 elsif new.status='cancelled' then
  update public.tenant_appointment_reminders set status='cancelled',updated_at=now(),last_error='Appointment cancelled.'
   where organization_id=new.organization_id and appointment_id=new.id and status in ('queued','failed');
 end if;
 return new;
end $$;
revoke all on function public.sync_tenant_appointment_reminders() from public,anon,authenticated;
grant execute on function public.sync_tenant_appointment_reminders() to service_role;
drop trigger if exists appointments_sync_tenant_reminders on public.appointments;
create trigger appointments_sync_tenant_reminders after insert or update of status,start_at,end_at on public.appointments
for each row execute function public.sync_tenant_appointment_reminders();

insert into public.tenant_appointment_reminders(organization_id,appointment_id,reminder_offset_minutes,scheduled_for,channel)
select a.organization_id,a.id,v.offset_minutes,a.start_at-make_interval(mins=>v.offset_minutes),'internal'
from public.appointments a cross join (values (1440),(120)) as v(offset_minutes)
where a.status in ('confirmed','rescheduled') and a.start_at>now() and a.end_at is not null
on conflict (organization_id,appointment_id,reminder_offset_minutes) do nothing;

create table if not exists public.tenant_appointment_reminder_notifications (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 appointment_id uuid not null,
 reminder_id uuid not null,
 title text not null,
 body text not null default '',
 status text not null default 'unread' check (status in ('unread','read','dismissed')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 foreign key (organization_id,appointment_id) references public.appointments(organization_id,id) on delete cascade,
 foreign key (organization_id,reminder_id) references public.tenant_appointment_reminders(organization_id,id) on delete cascade,
 unique (organization_id,reminder_id)
);
create index if not exists tenant_appointment_reminder_notifications_inbox_idx
 on public.tenant_appointment_reminder_notifications(organization_id,status,created_at desc);
alter table public.tenant_appointment_reminder_notifications enable row level security;
revoke all on public.tenant_appointment_reminder_notifications from public,anon,authenticated;
grant all on public.tenant_appointment_reminder_notifications to service_role;
