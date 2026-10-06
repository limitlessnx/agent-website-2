begin;

alter table public.payment_plans
  add column if not exists payment_type text not null default 'installment',
  add column if not exists end_at timestamptz;

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

create index if not exists payment_plans_org_type_idx
  on public.payment_plans (organization_id, payment_type, status, created_at desc);

create index if not exists payment_plans_org_end_at_idx
  on public.payment_plans (organization_id, end_at)
  where payment_type = 'installment' and end_at is not null;

commit;
