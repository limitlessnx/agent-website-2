begin;

do $$
declare
  v_definition text;
  v_old text := $old$next_scheduled_at := ((((effective_sent_at at time zone 'Africa/Lagos')::date + reminder_interval)::date + time '10:00') at time zone 'Africa/Lagos');$old$;
  v_new text := $new$if coalesce(new.payload->>'catch_up', 'false') = 'true'
         and nullif(new.payload->>'catch_up_next_date', '') is not null then
        next_scheduled_at := (((nullif(new.payload->>'catch_up_next_date', '')::date)::timestamp + time '10:00') at time zone 'Africa/Lagos');
      else
        next_scheduled_at := ((((effective_sent_at at time zone 'Africa/Lagos')::date + reminder_interval)::date + time '10:00') at time zone 'Africa/Lagos');
      end if;$new$;
begin
  v_definition := pg_get_functiondef('public.sync_limitless_payment_plan_reminder_cursor()'::regprocedure);
  if position('coalesce(new.installment_amount, 0) <= 0' in v_definition) > 0 then
    v_definition := replace(v_definition, 'coalesce(new.installment_amount, 0) <= 0', 'coalesce(new.installment_amount, 0) < 0');
  elsif position('coalesce(new.installment_amount, 0) < 0' in v_definition) = 0 then
    raise exception 'Unexpected reminder cursor function guard; refusing unsafe replacement';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[])'::regprocedure);
  if position('v_plan.installment_amount <= 0' in v_definition) > 0 then
    v_definition := replace(v_definition, 'v_plan.installment_amount <= 0', 'v_plan.installment_amount < 0');
  elsif position('v_plan.installment_amount < 0' in v_definition) = 0 then
    raise exception 'Unexpected reminder authorization guard; refusing unsafe replacement';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.sync_payment_plan_reminder_state()'::regprocedure);
  if position(v_old in v_definition) > 0 then
    v_definition := replace(v_definition, v_old, v_new);
  elsif position('new.payload->>''catch_up_next_date''' in v_definition) = 0 then
    raise exception 'Unexpected reminder state function body; refusing unsafe replacement';
  end if;
  execute v_definition;
end;
$$;

-- Recalculate only the Limitless Realty reminder cursors. No attempts or sends
-- are created by this migration.
update public.payment_plans
set reminder_template_id = reminder_template_id,
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
  and payment_type = 'installment'
  and status = 'active'
  and reminders_enabled = true
  and greatest(coalesce(agreed_price, 0) - coalesce(total_paid, 0), 0) > 0
  and next_due_date is not null
  and coalesce(installment_amount, 0) >= 0;

commit;
