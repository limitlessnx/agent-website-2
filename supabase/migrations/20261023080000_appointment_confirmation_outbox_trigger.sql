begin;

-- Enqueue in the same database transaction as booking creation/confirmation.
-- The HTTP handler's enqueue remains as an idempotent fallback for deployments
-- where this trigger migration has not yet been applied everywhere.
create or replace function public.enqueue_appointment_confirmation_outbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date text;
  v_time text;
  v_service text;
  v_name text;
begin
  if new.status <> 'confirmed' then
    return new;
  end if;

  -- The appointments table is shared across tenant systems. Only enqueue
  -- notifications for bookings created by the Xposure photography workflow.
  if coalesce(new.metadata->>'source', '') <> 'exposure_booking_form' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    return new;
  end if;

  if nullif(trim(coalesce(new.customer_phone, '')), '') is null then
    return new;
  end if;

  v_date := to_char(new.start_at at time zone 'Africa/Lagos', 'FMMonth FMDD, YYYY');
  v_time := to_char(new.start_at at time zone 'Africa/Lagos', 'FMHH12:MI AM');
  v_service := coalesce(nullif(trim(new.title), ''), 'Studio session');
  v_name := coalesce(nullif(trim(new.customer_name), ''), 'there');

  insert into public.appointment_notification_outbox (
    organization_id, appointment_id, event_key, channel, purpose,
    recipient, template_name, variables, status
  ) values (
    new.organization_id,
    new.id,
    'appointment-confirmed:' || new.id::text,
    'whatsapp',
    'appointment_reminder',
    trim(new.customer_phone),
    'appointment_reminder',
    jsonb_build_object(
      'customer_name', v_name,
      'business_name', 'Xposure Studios',
      'service_name', v_service,
      'appointment_date', v_date,
      'appointment_time', v_time,
      'booking_reference', new.id::text
    ),
    'queued'
  )
  on conflict (organization_id, event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists appointments_enqueue_confirmation_outbox on public.appointments;
create trigger appointments_enqueue_confirmation_outbox
after insert or update of status on public.appointments
for each row
when (new.status = 'confirmed')
execute function public.enqueue_appointment_confirmation_outbox();

revoke all on function public.enqueue_appointment_confirmation_outbox() from public, anon, authenticated;

commit;
