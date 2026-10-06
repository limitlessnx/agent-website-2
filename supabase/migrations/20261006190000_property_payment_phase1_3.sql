begin;

alter table public.payment_plans
  add column if not exists contact_id uuid,
  add column if not exists currency text not null default 'NGN',
  add column if not exists payment_type text not null default 'installment',
  add column if not exists start_at timestamptz not null default now(),
  add column if not exists end_at timestamptz,
  add column if not exists handover_agent_name text,
  add column if not exists handover_agent_phone text,
  add column if not exists reminder_template_id uuid,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists next_reminder_at timestamptz;

alter table public.payment_plans
  drop constraint if exists payment_plans_payment_type_check;

alter table public.payment_plans
  add constraint payment_plans_payment_type_check
  check (payment_type in ('installment','outright'));

alter table public.payment_plans
  drop constraint if exists payment_plans_end_at_after_start_check;

alter table public.payment_plans
  add constraint payment_plans_end_at_after_start_check
  check (end_at is null or end_at >= start_at);

update public.payment_plans
set start_at = coalesce(start_at, created_at),
    end_at = coalesce(
      end_at,
      case
        when final_due_date is not null
        then final_due_date::timestamptz + interval '23 hours 59 minutes 59.999 seconds'
        else null
      end
    ),
    payment_type = coalesce(payment_type, 'installment'),
    currency = coalesce(nullif(currency, ''), 'NGN'),
    updated_at = now();

create index if not exists payment_plans_org_type_idx
  on public.payment_plans (organization_id, payment_type, status, created_at desc);

create index if not exists payment_plans_org_end_at_idx
  on public.payment_plans (organization_id, end_at)
  where payment_type = 'installment' and end_at is not null;

create or replace function public.installment_frequency_interval(p_frequency text)
returns interval
language sql
immutable
as $function$
  select case lower(regexp_replace(coalesce(p_frequency,''), '[-\s]+', '_'))
    when 'weekly' then interval '7 days'
    when 'week' then interval '7 days'
    when 'every_week' then interval '7 days'
    when '7_days' then interval '7 days'
    when 'biweekly' then interval '14 days'
    when 'bi_weekly' then interval '14 days'
    when 'fortnightly' then interval '14 days'
    when 'every_2_weeks' then interval '14 days'
    when '2_weeks' then interval '14 days'
    when '14_days' then interval '14 days'
    when 'monthly' then interval '30 days'
    when 'month' then interval '30 days'
    when 'every_month' then interval '30 days'
    when '30_days' then interval '30 days'
    else interval '14 days'
  end
$function$;

create or replace function public.sync_payment_plan_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  target_plan uuid;
  paid numeric(18,2);
  latest_payment_date date;
  plan_start timestamptz;
  plan_frequency text;
begin
  target_plan := coalesce(new.payment_plan_id, old.payment_plan_id);

  select coalesce(sum(amount), 0), max(payment_date)
    into paid, latest_payment_date
  from public.payment_records
  where payment_plan_id = target_plan;

  select start_at, frequency
    into plan_start, plan_frequency
  from public.payment_plans
  where id = target_plan
  for update;

  update public.payment_plans
  set total_paid = paid,
      status = case
        when agreed_price > 0 and paid >= agreed_price then 'completed'
        when status = 'completed' and paid < agreed_price then 'active'
        else status
      end,
      reminders_enabled = case
        when agreed_price > 0 and paid >= agreed_price then false
        when status = 'completed' and paid < agreed_price then true
        else reminders_enabled
      end,
      next_reminder_at = case
        when agreed_price > 0 and paid >= agreed_price then null
        when latest_payment_date is not null then latest_payment_date::timestamptz + public.installment_frequency_interval(plan_frequency)
        else coalesce(plan_start, now()) + public.installment_frequency_interval(plan_frequency)
      end,
      updated_at = now()
  where id = target_plan;

  return coalesce(new, old);
end;
$function$;

revoke all on function public.installment_frequency_interval(text) from public, anon, authenticated;
grant execute on function public.installment_frequency_interval(text) to service_role;

commit;
