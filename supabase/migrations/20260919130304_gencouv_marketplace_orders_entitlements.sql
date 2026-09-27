-- Marketplace payment + entitlement layer.
-- Safe to run after supabase/schema.sql and safe to re-run during development.

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  claimed_at timestamptz,
  sku text not null,
  product_slug text not null,
  license_tier text not null,
  price_amount numeric(12,2) not null,
  price_currency text not null default 'usd',
  payment_provider text not null default 'nowpayments',
  provider_payment_id text,
  provider_invoice_id text,
  payment_status text not null default 'waiting',
  paid_amount numeric(20,8),
  pay_currency text,
  fulfilled_at timestamptz,
  fulfillment_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.marketplace_orders add column if not exists customer_email text;
alter table public.marketplace_orders add column if not exists claimed_at timestamptz;
alter table public.marketplace_orders add column if not exists fulfillment_email_sent_at timestamptz;
alter table public.marketplace_orders alter column user_id drop not null;

create index if not exists marketplace_orders_user_idx on public.marketplace_orders(user_id);
create index if not exists marketplace_orders_email_idx on public.marketplace_orders(lower(customer_email));
create index if not exists marketplace_orders_status_idx on public.marketplace_orders(payment_status);

create table if not exists public.marketplace_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_email text,
  order_id text not null references public.marketplace_orders(order_id) on delete restrict,
  product_slug text not null,
  license_tier text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, product_slug, license_tier)
);

alter table public.marketplace_entitlements add column if not exists customer_email text;
alter table public.marketplace_entitlements add column if not exists claimed_at timestamptz;
alter table public.marketplace_entitlements alter column user_id drop not null;
alter table public.marketplace_entitlements drop constraint if exists marketplace_entitlements_status_check;
alter table public.marketplace_entitlements add constraint marketplace_entitlements_status_check check (status in ('active','unclaimed','expired','revoked'));

create index if not exists marketplace_entitlements_user_idx on public.marketplace_entitlements(user_id);
create index if not exists marketplace_entitlements_email_idx on public.marketplace_entitlements(lower(customer_email));

alter table public.marketplace_orders enable row level security;
alter table public.marketplace_entitlements enable row level security;

drop policy if exists "Users can view own marketplace orders" on public.marketplace_orders;
create policy "Users can view own marketplace orders" on public.marketplace_orders
for select using (auth.uid() = user_id);

drop policy if exists "Users can view own marketplace entitlements" on public.marketplace_entitlements;
create policy "Users can view own marketplace entitlements" on public.marketplace_entitlements
for select using (auth.uid() = user_id);
