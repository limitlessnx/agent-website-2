begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.sync_payment_plan_reminder_state()'::regprocedure);
  if position('time ''10:00''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''10:00''', 'time ''14:30''');
  elsif position('time ''14:30''' in v_definition) = 0 then
    raise exception 'Unexpected reminder recurrence function; refusing unsafe replacement';
  end if;
  execute v_definition;
end;
$$;

-- Preserve the configured local calendar date while moving eligible Limitless
-- Realty installment reminder cursors to the 14:30 Lagos send window.
update public.payment_plans
set next_reminder_at = (((next_reminder_at at time zone 'Africa/Lagos')::date + time '14:30') at time zone 'Africa/Lagos'),
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and greatest(coalesce(agreed_price, 0) - coalesce(total_paid, 0), 0) > 0
  and next_due_date is not null
  and next_reminder_at is not null;

commit;
