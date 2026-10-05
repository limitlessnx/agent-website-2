begin;

alter table public.payment_plans
  add column if not exists contact_id uuid,
  add column if not exists currency text not null default 'NGN',
  add column if not exists start_at timestamptz not null default now(),
  add column if not exists handover_agent_name text,
  add column if not exists handover_agent_phone text,
  add column if not exists reminder_template_id uuid,
  add column if not exists last_reminder_at timestamptz,
  add column if not exists next_reminder_at timestamptz;

create unique index if not exists leads_organization_id_id_unique
  on public.leads (organization_id, id);

alter table public.payment_plans
  add constraint payment_plans_tenant_contact_fkey
  foreign key (organization_id, contact_id)
  references public.leads (organization_id, id)
  on delete set null;

alter table public.payment_plans
  add constraint payment_plans_tenant_reminder_template_fkey
  foreign key (organization_id, reminder_template_id)
  references public.reminder_templates (organization_id, id)
  on delete set null;

create index if not exists payment_plans_org_reminder_idx
  on public.payment_plans (organization_id, status, reminders_enabled, next_reminder_at)
  where reminders_enabled is true;

create or replace function public.installment_frequency_interval(p_frequency text)
returns interval
language sql
immutable
as $$
  select case lower(regexp_replace(coalesce(p_frequency,''), '[-\\s]+', '_'))
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
$$;

create or replace function public.sync_payment_plan_total()
returns trigger
language plpgsql
security definer
set search_path to public
as $function$
declare
  target_plan uuid;
  paid numeric(18,2);
  latest_payment_date date;
  plan_start timestamptz;
  plan_frequency text;
  plan_status text;
begin
  target_plan := coalesce(new.payment_plan_id, old.payment_plan_id);

  select
    coalesce(sum(amount), 0),
    max(payment_date)
  into paid, latest_payment_date
  from public.payment_records
  where payment_plan_id = target_plan;

  select start_at, frequency, status
  into plan_start, plan_frequency, plan_status
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
        when latest_payment_date is not null then (latest_payment_date::timestamptz + public.installment_frequency_interval(plan_frequency))
        else (coalesce(plan_start, now()) + public.installment_frequency_interval(plan_frequency))
      end,
      updated_at = now()
  where id = target_plan;

  return coalesce(new, old);
end;
$function$;

update public.payment_plans
set start_at = coalesce(start_at, created_at),
    next_reminder_at = coalesce(
      next_reminder_at,
      case
        when total_paid > 0 then (
          select max(pr.payment_date)::timestamptz + public.installment_frequency_interval(payment_plans.frequency)
          from public.payment_records pr
          where pr.payment_plan_id = payment_plans.id
        )
        else coalesce(start_at, created_at) + public.installment_frequency_interval(frequency)
      end
    ),
    updated_at = now();

update public.reminder_templates
set enabled = false,
    updated_at = now()
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

insert into public.reminder_templates (
  organization_id, name, position, timing_direction, timing_days, channel,
  message_template, escalation_action, enabled
)
values (
  'b15f21b4-5697-4d21-9421-8a34eae3476d',
  'Installment Payment Reminder',
  1,
  'on',
  0,
  'whatsapp',
  'Hello {{client_name}} 👋

Just a quick update regarding your installment payment for {{property_name}}.

You have currently paid {{amount_paid}}, with {{outstanding_balance}} remaining.

Your installment plan is still active, so we''re reaching out with a friendly reminder regarding your payment.

If you need any information or assistance with your payment, please contact {{handover_agent_name}} on WhatsApp: {{handover_agent_phone}}.

We''re happy to assist.

Thank you for choosing {{company_name}}.',
  'Routine customer check-in. No escalation.',
  true
)
on conflict do nothing;

update public.payment_plans
set reminder_template_id = (
  select rt.id
  from public.reminder_templates rt
  where rt.organization_id = public.payment_plans.organization_id
    and rt.name = 'Installment Payment Reminder'
  order by rt.position asc
  limit 1
)
where reminder_template_id is null
  and organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

insert into public.whatsapp_template_configs (
  organization_id, purpose, template_name, language_code, variable_keys, status, metadata
)
values (
  'b15f21b4-5697-4d21-9421-8a34eae3476d',
  'installment_payment_reminder',
  'installment_payment_reminder',
  'en_US',
  '["client_name","property_name","amount_paid","outstanding_balance","handover_agent_name","handover_agent_phone","company_name"]'::jsonb,
  'active',
  '{"source":"meta_approved_template","category":"utility","editable_local_copy":true}'::jsonb
)
on conflict (organization_id, purpose)
do update set
  template_name = excluded.template_name,
  language_code = excluded.language_code,
  variable_keys = excluded.variable_keys,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

commit;
