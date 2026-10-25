-- Xposure-only booking lifecycle. Payment instructions remain in Maia's knowledge base;
-- no bank account details or payment-provider integration are stored in the application database.
create table if not exists public.xposure_bookings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_name text not null, customer_phone text not null,
 service_type text not null check (service_type in ('photography','studio_rental','wedding','videography','custom')),
 package_name text, service_details jsonb not null default '{}'::jsonb,
 requested_start_at timestamptz, requested_end_at timestamptz, timezone text not null default 'Africa/Lagos',
 amount_minor bigint not null check (amount_minor >= 0), currency text not null default 'NGN' check (currency = 'NGN'),
 booking_status text not null default 'pending' check (booking_status in ('pending','awaiting_payment','payment_review','confirmed','completed','cancelled','expired')),
 -- Staff-entered workflow status only, never a bank/payment verification integration.
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','receipt_submitted','verified','rejected','refunded')),
 payment_reference text, payment_verified_by uuid, payment_verified_at timestamptz, confirmed_by uuid, confirmed_at timestamptz,
 follow_up_state text not null default 'none' check (follow_up_state in ('none','awaiting_payment','receipt_review','paused','completed')),
 last_follow_up_at timestamptz, idempotency_key text not null, conversation_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organization_id, idempotency_key), unique (organization_id, id),
 check (requested_end_at is null or requested_start_at is null or requested_end_at > requested_start_at),
 check (booking_status <> 'confirmed' or (payment_status = 'verified' and confirmed_at is not null))
);
create index if not exists xposure_bookings_org_status_created_idx on public.xposure_bookings (organization_id, booking_status, created_at desc);
create index if not exists xposure_bookings_org_requested_start_idx on public.xposure_bookings (organization_id, requested_start_at) where booking_status in ('pending','awaiting_payment','payment_review','confirmed');
alter table public.xposure_bookings enable row level security;
revoke all on public.xposure_bookings from public, anon, authenticated;
grant all on public.xposure_bookings to service_role;
