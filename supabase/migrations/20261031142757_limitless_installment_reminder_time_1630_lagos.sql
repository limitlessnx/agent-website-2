begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.sync_payment_plan_reminder_state()'::regprocedure);
  if position('time ''14:30''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''14:30''', 'time ''16:30''');
  elsif position('time ''10:00''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''10:00''', 'time ''16:30''');
  elsif position('time ''16:30''' in v_definition) = 0 then
    raise exception 'Unexpected reminder schedule function; refusing unsafe replacement';
  end if;
  execute v_definition;
end;
$$;

-- Move only the existing eligible Limitless Realty installment reminder
-- cursor to 16:30 Lagos, preserving each plan's already-configured calendar date.
update public.payment_plans
set next_reminder_at = (((next_reminder_at at time zone 'Africa/Lagos')::date + time '16:30') at time zone 'Africa/Lagos'),
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and greatest(coalesce(agreed_price, 0) - coalesce(total_paid, 0), 0) > 0
  and next_due_date is not null
  and next_reminder_at is not null;

commit;
