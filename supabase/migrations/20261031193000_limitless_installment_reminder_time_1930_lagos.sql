begin;

-- Keep all active database scheduling paths aligned: initial cursor creation,
-- send authorization, post-send recurrence, and missed-window advancement.
do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.sync_limitless_payment_plan_reminder_cursor()'::regprocedure);
  if position('interval ''10 hours''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'interval ''10 hours''', 'interval ''19 hours 30 minutes''');
  elsif position('interval ''19 hours 30 minutes''' in v_definition) = 0 then
    raise exception 'Unexpected initial reminder cursor function; refusing unsafe replacement';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[])'::regprocedure);
  if position('time ''10:00:00''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''10:00:00''', 'time ''19:30:00''');
  elsif position('time ''19:30:00''' in v_definition) = 0 then
    raise exception 'Unexpected reminder authorization clock; refusing unsafe replacement';
  end if;
  if position('interval ''10 hours''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'interval ''10 hours''', 'interval ''19 hours 30 minutes''');
  elsif position('interval ''19 hours 30 minutes''' in v_definition) = 0 then
    raise exception 'Unexpected reminder authorization occurrence; refusing unsafe replacement';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.sync_payment_plan_reminder_state()'::regprocedure);
  if position('time ''16:30''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''16:30''', 'time ''19:30''');
  elsif position('time ''14:30''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''14:30''', 'time ''19:30''');
  elsif position('time ''10:00''' in v_definition) > 0 then
    v_definition := replace(v_definition, 'time ''10:00''', 'time ''19:30''');
  elsif position('time ''19:30''' in v_definition) = 0 then
    raise exception 'Unexpected reminder recurrence function; refusing unsafe replacement';
  end if;
  execute v_definition;
end;
$$;

-- Preserve each eligible plan's local calendar date and all financial/payment data.
update public.payment_plans
set next_reminder_at = (((next_reminder_at at time zone 'Africa/Lagos')::date + time '19:30') at time zone 'Africa/Lagos'),
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and greatest(coalesce(agreed_price, 0) - coalesce(total_paid, 0), 0) > 0
  and next_due_date is not null
  and next_reminder_at is not null;

commit;
