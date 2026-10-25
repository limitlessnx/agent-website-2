-- Xposure-only booking and payment lifecycle. Apply via reviewed migration after PR checks.
create table if not exists public.xposure_payment_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number text not null check (account_number ~ '^[0-9]{10}$'),
  currency text not null default 'NGN' check (currency = 'NGN'),
  verified boolean not null default false,
  enabled boolean not null default false,
  staff_receipt_destination text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.xposure_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service_type text not null check (service_type in ('photography','studio_rental','wedding','videography','custom')),
  package_name text,
  service_details jsonb not null default '{}'::jsonb,
  requested_start_at timestamptz,
  requested_end_at timestamptz,
  timezone text not null default 'Africa/Lagos',
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  booking_status text not null default 'pending' check (booking_status in ('pending','awaiting_payment','payment_review','confirmed','completed','cancelled','expired')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','receipt_submitted','verified','rejected','refunded')),
  receipt_url text,
  payment_reference text,
  payment_verified_by uuid,
  payment_verified_at timestamptz,
  confirmed_by uuid,
  confirmed_at timestamptz,
  follow_up_state text not null default 'none' check (follow_up_state in ('none','awaiting_payment','receipt_review','paused','completed')),
  last_follow_up_at timestamptz,
  idempotency_key text not null,
  conversation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (organization_id, id),
  check (requested_end_at is null or requested_start_at is null or requested_end_at > requested_start_at),
  check (booking_status <> 'confirmed' or (payment_status = 'verified' and confirmed_at is not null))
);
create index if not exists xposure_bookings_org_status_created_idx on public.xposure_bookings (organization_id, booking_status, created_at desc);
create index if not exists xposure_bookings_org_requested_start_idx on public.xposure_bookings (organization_id, requested_start_at) where booking_status in ('pending','awaiting_payment','payment_review','confirmed');
alter table public.xposure_payment_settings enable row level security;
alter table public.xposure_bookings enable row level security;
revoke all on public.xposure_payment_settings from public, anon, authenticated;
revoke all on public.xposure_bookings from public, anon, authenticated;
grant all on public.xposure_payment_settings to service_role;
grant all on public.xposure_bookings to service_role;

-- Configure only the Xposure tenant. The values are disabled until a manager verifies them in the dashboard.
insert into public.xposure_payment_settings (organization_id, bank_name, account_name, account_number, currency, verified, enabled)
select id, 'UBA', 'Xposure Enterprise', '1029421643', 'NGN', false, false
from public.organizations where slug = 'xposure'
on conflict (organization_id) do nothing;
