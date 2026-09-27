CREATE OR REPLACE FUNCTION public.sync_payment_plan_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  target_plan uuid;
  paid numeric(18,2);
begin
  target_plan := coalesce(new.payment_plan_id, old.payment_plan_id);
  select coalesce(sum(amount), 0) into paid
  from public.payment_records
  where payment_plan_id = target_plan;

  update public.payment_plans
  set total_paid = paid,
      status = case when agreed_price > 0 and paid >= agreed_price then 'completed' else status end,
      reminders_enabled = case when agreed_price > 0 and paid >= agreed_price then false else reminders_enabled end,
      updated_at = now()
  where id = target_plan;

  return coalesce(new, old);
end;
$function$;

UPDATE public.payment_plans p
SET total_paid = coalesce(x.paid, 0),
    updated_at = now()
FROM (
  SELECT p2.id, coalesce(sum(r.amount), 0) AS paid
  FROM public.payment_plans p2
  LEFT JOIN public.payment_records r ON r.payment_plan_id = p2.id
  GROUP BY p2.id
) x
WHERE p.id = x.id;
