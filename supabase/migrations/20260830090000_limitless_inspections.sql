create table if not exists public.limitless_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lead_id uuid not null,
  customer_id uuid,
  property_id uuid,
  property_name text,
  scheduled_at timestamptz not null,
  timezone text not null default 'Africa/Lagos',
  status text not null default 'booked' check (status in ('booked','confirmed','completed','cancelled','rescheduled','no_show')),
  source text not null default 'dashboard',
  notes text,
  reminder_24h_task_id uuid,
  reminder_2h_task_id uuid,
  post_followup_task_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists limitless_inspections_org_scheduled_idx
  on public.limitless_inspections (organization_id, scheduled_at desc);
create index if not exists limitless_inspections_lead_idx
  on public.limitless_inspections (organization_id, lead_id, status);

alter table public.limitless_inspections enable row level security;

comment on table public.limitless_inspections is 'Authoritative inspection appointments for Limitless Realty. Writes are performed by trusted server-side service-role paths.';
