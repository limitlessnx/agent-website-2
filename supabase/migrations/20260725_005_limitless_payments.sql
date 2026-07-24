create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_name text not null,
  client_phone text not null,
  client_email text,
  property_id text,
  property_title text not null,
  agreed_price numeric(18,2) not null default 0 check (agreed_price >= 0),
  total_paid numeric(18,2) not null default 0 check (total_paid >= 0),
  outstanding_balance numeric(18,2) generated always as (greatest(agreed_price - total_paid, 0)) stored,
  installment_amount numeric(18,2) not null default 0 check (installment_amount >= 0),
  frequency text not null default 'custom',
  next_due_date date,
  final_due_date date,
  status text not null default 'active' check (status in ('active','due_soon','overdue','completed','paused','cancelled')),
  assigned_agent text,
  notes text,
  reminders_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_records (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans(id) on delete cascade,
  amount numeric(18,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text,
  payment_reference text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  position integer not null default 1,
  timing_direction text not null default 'before' check (timing_direction in ('before','on','after')),
  timing_days integer not null default 0 check (timing_days >= 0),
  channel text not null default 'placeholder' check (channel in ('placeholder','whatsapp','email','sms')),
  message_template text not null default '[Reminder message placeholder]',
  escalation_action text not null default '[Escalation placeholder]',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminder_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans(id) on delete cascade,
  reminder_template_id uuid references public.reminder_templates(id) on delete set null,
  scheduled_for timestamptz,
  sent_at timestamptz,
  channel text,
  status text not null default 'pending' check (status in ('pending','queued','sent','failed','cancelled','skipped')),
  provider_reference text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_plans_status_due_idx on public.payment_plans(status, next_due_date);
create index if not exists payment_records_plan_date_idx on public.payment_records(payment_plan_id, payment_date desc);
create index if not exists reminder_templates_position_idx on public.reminder_templates(position);
create index if not exists reminder_attempts_status_schedule_idx on public.reminder_attempts(status, scheduled_for);

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
  select coalesce(sum(amount), 0) into paid from public.payment_records where payment_plan_id = target_plan;
  update public.payment_plans
  set total_paid = paid,
      status = case when agreed_price > 0 and paid >= agreed_price then 'completed' else status end,
      reminders_enabled = case when agreed_price > 0 and paid >= agreed_price then false else reminders_enabled end,
      updated_at = now()
  where id = target_plan;
  return coalesce(new, old);
end;
$$;

drop trigger if exists payment_records_sync_total on public.payment_records;
create trigger payment_records_sync_total
after insert or update or delete on public.payment_records
for each row execute function public.sync_payment_plan_total();

drop trigger if exists payment_plans_set_updated_at on public.payment_plans;
create trigger payment_plans_set_updated_at before update on public.payment_plans for each row execute function public.set_updated_at();
drop trigger if exists reminder_templates_set_updated_at on public.reminder_templates;
create trigger reminder_templates_set_updated_at before update on public.reminder_templates for each row execute function public.set_updated_at();

alter table public.payment_plans enable row level security;
alter table public.payment_records enable row level security;
alter table public.reminder_templates enable row level security;
alter table public.reminder_attempts enable row level security;

insert into public.reminder_templates (name, position, timing_direction, timing_days, channel, message_template, escalation_action)
select * from (values
  ('Reminder 1', 1, 'before', 0, 'placeholder', '[Reminder message placeholder]', '[Escalation placeholder]'),
  ('Reminder 2', 2, 'on', 0, 'placeholder', '[Reminder message placeholder]', '[Escalation placeholder]'),
  ('Reminder 3', 3, 'after', 0, 'placeholder', '[Follow-up message placeholder]', '[Escalation placeholder]')
) as seed(name, position, timing_direction, timing_days, channel, message_template, escalation_action)
where not exists (select 1 from public.reminder_templates);
