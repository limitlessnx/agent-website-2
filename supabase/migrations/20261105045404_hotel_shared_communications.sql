-- Hotel communications extend canonical CRM; no payment, room inventory or staff records.
create table public.hotel_guest_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  marketing_consent text not null default 'unknown' check (marketing_consent in ('unknown','opted_in','opted_out')),
  service_consent text not null default 'unknown' check (service_consent in ('unknown','opted_in','opted_out')),
  opted_out boolean not null default false,
  human_handoff boolean not null default false,
  consent_source text not null default 'manager',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id,customer_id),
  foreign key (organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade
);
create table public.hotel_booking_enquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  status text not null default 'enquiry' check (status in ('enquiry','quoted','confirmed','checked_in','checked_out','cancelled','expired')),
  revision integer not null default 1 check (revision > 0),
  arrival_date date,
  departure_date date,
  updated_by uuid,
  created_at timestamptz not null default now(),
  unique (organization_id,id,customer_id),
  check (departure_date is null or arrival_date is null or departure_date > arrival_date),
  foreign key (organization_id,customer_id) references public.hotel_guest_profiles(organization_id,customer_id) on delete cascade
);
create table public.hotel_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  booking_id uuid not null,
  booking_revision integer not null,
  purpose text not null check (purpose in ('booking_recovery','pre_arrival','post_stay')),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','cancelled','accepted','unknown')),
  request_id uuid not null,
  message text not null check (length(trim(message)) between 1 and 4000),
  template_name text,
  variables jsonb not null default '{}'::jsonb,
  provider_message_id text,
  stop_reason text,
  created_at timestamptz not null default now(),
  unique (organization_id,request_id),
  foreign key (organization_id,booking_id,customer_id) references public.hotel_booking_enquiries(organization_id,id,customer_id) on delete cascade
);
create index hotel_followups_due_idx on public.hotel_followups(organization_id,scheduled_at) where status='pending';
create index hotel_bookings_customer_idx on public.hotel_booking_enquiries(organization_id,customer_id);

alter table public.hotel_guest_profiles enable row level security;
alter table public.hotel_booking_enquiries enable row level security;
alter table public.hotel_followups enable row level security;
revoke all on public.hotel_guest_profiles, public.hotel_booking_enquiries, public.hotel_followups from public, anon, authenticated;
grant select on public.hotel_guest_profiles, public.hotel_booking_enquiries, public.hotel_followups to authenticated;
grant all on public.hotel_guest_profiles, public.hotel_booking_enquiries, public.hotel_followups to service_role;
create policy hotel_guests_read on public.hotel_guest_profiles for select to authenticated
  using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_bookings_read on public.hotel_booking_enquiries for select to authenticated
  using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy hotel_followups_read on public.hotel_followups for select to authenticated
  using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));

-- Cancel queued and claimed reminders in the same transaction as a lifecycle/date change.
create function public.hotel_booking_revision_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.organization_id,new.customer_id,new.id) is distinct from (old.organization_id,old.customer_id,old.id) then
    raise exception 'Booking identity is immutable';
  end if;
  new.revision := old.revision;
  if (new.status,new.arrival_date,new.departure_date) is distinct from (old.status,old.arrival_date,old.departure_date) then
    new.revision := old.revision + 1;
    update public.hotel_followups set status='cancelled',stop_reason='booking_changed'
      where organization_id=old.organization_id and booking_id=old.id and status in ('pending','processing');
  end if;
  return new;
end $$;
create trigger hotel_booking_revision before update on public.hotel_booking_enquiries for each row execute function public.hotel_booking_revision_guard();

-- Serialize enrollment with booking updates, preventing scheduling against an obsolete revision.
create function public.hotel_followup_revision_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b public.hotel_booking_enquiries;
begin
  select * into b from public.hotel_booking_enquiries where organization_id=new.organization_id and id=new.booking_id and customer_id=new.customer_id for update;
  if not found or b.revision <> new.booking_revision then raise exception 'Booking changed before enrollment'; end if;
  if not ((new.purpose='booking_recovery' and b.status in ('enquiry','quoted')) or (new.purpose='pre_arrival' and b.status='confirmed') or (new.purpose='post_stay' and b.status='checked_out')) then raise exception 'Booking state is ineligible'; end if;
  return new;
end $$;
create trigger hotel_followup_revision before insert on public.hotel_followups for each row execute function public.hotel_followup_revision_guard();
revoke all on function public.hotel_booking_revision_guard(), public.hotel_followup_revision_guard() from public,anon,authenticated;

create function public.hotel_guest_suppression_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.organization_id,new.customer_id) is distinct from (old.organization_id,old.customer_id) then raise exception 'Guest identity is immutable'; end if;
  new.updated_at := now();
  if new.opted_out or new.human_handoff or new.service_consent <> 'opted_in' then
    update public.hotel_followups set status='cancelled',stop_reason='guest_contact_suppressed'
      where organization_id=old.organization_id and customer_id=old.customer_id and status in ('pending','processing');
  end if;
  return new;
end $$;
create trigger hotel_guest_suppression before update on public.hotel_guest_profiles for each row execute function public.hotel_guest_suppression_guard();
revoke all on function public.hotel_guest_suppression_guard() from public,anon,authenticated;
