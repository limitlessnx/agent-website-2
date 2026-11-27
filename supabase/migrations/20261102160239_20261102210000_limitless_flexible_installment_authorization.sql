begin;

-- Production already has the earlier flexible-installment migrations recorded.
-- Update the live authorization function with a forward-only migration so a
-- missing fixed installment amount does not block a reminder whose runtime
-- amount is derived from the verified outstanding balance.
do $$
declare
  v_definition text;
begin
  v_definition := pg_get_functiondef(
    'public.authorize_limitless_installment_reminder_send(uuid,uuid,uuid,uuid,timestamptz,text[])'::regprocedure
  );

  v_definition := replace(
    v_definition,
    'or v_plan.installment_amount is null or v_plan.installment_amount < 0',
    'or v_plan.installment_amount < 0'
  );
  v_definition := replace(
    v_definition,
    'or v_plan.installment_amount > v_plan.agreed_price',
    ''
  );

  if position('v_plan.installment_amount is null' in v_definition) > 0
     or position('v_plan.installment_amount > v_plan.agreed_price' in v_definition) > 0 then
    raise exception 'Unexpected installment authorization guard; refusing unsafe replacement';
  end if;

  execute v_definition;
end $$;

commit;
