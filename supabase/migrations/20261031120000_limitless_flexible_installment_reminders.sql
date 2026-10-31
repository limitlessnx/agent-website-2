begin;

do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef('public.sync_limitless_payment_plan_reminder_cursor()'::regprocedure);
  if position('coalesce(new.installment_amount, 0) <= 0' in v_definition) > 0 then
    v_definition := replace(v_definition,
      'coalesce(new.installment_amount, 0) <= 0',
      'coalesce(new.installment_amount, 0) < 0');
  elsif position('coalesce(new.installment_amount, 0) < 0' in v_definition) = 0 then
    raise exception 'Unexpected reminder cursor function guard; refusing unsafe replacement';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef('public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[])'::regprocedure);
  if position('v_plan.installment_amount <= 0' in v_definition) > 0 then
    v_definition := replace(v_definition,
      'v_plan.installment_amount <= 0',
      'v_plan.installment_amount < 0');
  elsif position('v_plan.installment_amount < 0' in v_definition) = 0 then
    raise exception 'Unexpected reminder authorization guard; refusing unsafe replacement';
  end if;
  execute v_definition;
end;
$$;

-- Recalculate reminder cursors for eligible active plans after relaxing the
-- fixed-deposit guard. This does not create attempts or send messages.
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