-- Keep payment-plan totals authoritative when payment records are inserted, edited, or deleted.
-- outstanding_balance is a generated column, so only total_paid is written here.

create or replace function public.sync_payment_plan_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_plan uuid;
  paid numeric(18,2);
begin
  target_plan := coalesce(new.payment_plan_id, old.payment_plan_id);

  select coalesce(sum(amount), 0)
    into paid
    from public.payment_records
   where payment_plan_id = target_plan;

  update public.payment_plans
     set total_paid = paid,
         status = case
           when agreed_price > 0 and paid >= agreed_price then 'completed'
           else status
         end,
         reminders_enabled = case
           when agreed_price > 0 and paid >= agreed_price then false
           else reminders_enabled
         end,
         updated_at = now()
   where id = target_plan;

  return coalesce(new, old);
end;
$$;

update public.payment_plans p
   set total_paid = coalesce(x.paid, 0),
       updated_at = now()
  from (
    select p2.id, coalesce(sum(r.amount), 0) as paid
      from public.payment_plans p2
      left join public.payment_records r on r.payment_plan_id = p2.id
     group by p2.id
  ) x
 where p.id = x.id;
