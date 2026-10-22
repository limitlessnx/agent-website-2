-- Enforce tenant-wide simultaneous appointment capacity at the database layer.
-- The advisory transaction lock serializes overlapping booking writes per tenant,
-- closing the race where two concurrent requests both pass an application count.
create or replace function public.enforce_tenant_appointment_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_capacity integer := 1;
  active_overlap_count integer := 0;
begin
  if new.status not in ('pending_availability', 'confirmed', 'rescheduled') then
    return new;
  end if;

  -- Serialize booking changes for this organization until the transaction commits.
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 731904));

  select greatest(1, least(100,
    case
      when coalesce(s.availability_configuration->>'maxConcurrentAppointments', '') ~ '^\d+$'
        then (s.availability_configuration->>'maxConcurrentAppointments')::integer
      else 1
    end
  ))
  into configured_capacity
  from (select 1) seed
  left join public.appointment_availability_settings s
    on s.organization_id = new.organization_id;

  select count(*)
    into active_overlap_count
  from public.appointments a
  where a.organization_id = new.organization_id
    and a.id is distinct from new.id
    and a.status in ('pending_availability', 'confirmed', 'rescheduled')
    and a.start_at < new.end_at
    and a.end_at > new.start_at;

  if active_overlap_count >= configured_capacity then
    raise exception 'TENANT_APPOINTMENT_CAPACITY_REACHED: maximum % simultaneous appointment(s)', configured_capacity
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists appointments_capacity_guard on public.appointments;
create trigger appointments_capacity_guard
before insert or update of organization_id, start_at, end_at, status
on public.appointments
for each row execute function public.enforce_tenant_appointment_capacity();

comment on function public.enforce_tenant_appointment_capacity() is
  'Serializes appointment writes per tenant and enforces maxConcurrentAppointments from appointment_availability_settings; default capacity is one.';
