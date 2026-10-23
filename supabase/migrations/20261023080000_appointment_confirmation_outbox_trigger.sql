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
  -- The appointments table is shared across tenant systems. Only process
  -- bookings created by the Xposure photography workflow.
  if coalesce(new.metadata->>'source', '') <> 'exposure_booking_form' then
    return new;
  end if;

  -- Cancellation prevents any still-queued confirmation from being delivered.
  -- A processing row is deliberately left untouched because the provider call
  -- may already be in flight; it must be reconciled rather than blindly retried.
  if tg_op = 'UPDATE' and new.status = 'cancelled' then
    update public.appointment_notification_outbox
      set status = 'cancelled', updated_at = now(),
          last_error = 'Booking cancelled before notification was claimed.'
      where organization_id = new.organization_id
        and appointment_id = new.id
        and status = 'queued';
    return new;
  end if;

  if new.status <> 'confirmed' then
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
    'appointment-confirmed:' || new.id::text || ':' || coalesce(nullif(new.metadata->>'confirmation_event_id', ''), new.id::text),
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
  on conflict (organization_id, event_key) do update
    set status = 'queued',
        recipient = excluded.recipient,
        template_name = excluded.template_name,
        variables = excluded.variables,
        queued_at = now(),
        processing_at = null,
        sent_at = null,
        provider_message_id = null,
        last_error = null,
        updated_at = now()
    where public.appointment_notification_outbox.status in ('cancelled', 'failed');

  return new;
end;
$$;

drop trigger if exists appointments_enqueue_confirmation_outbox on public.appointments;
create trigger appointments_enqueue_confirmation_outbox
after insert or update of status on public.appointments
for each row
when (new.status in ('confirmed', 'cancelled'))
execute function public.enqueue_appointment_confirmation_outbox();

revoke all on function public.enqueue_appointment_confirmation_outbox() from public, anon, authenticated;

commit;
