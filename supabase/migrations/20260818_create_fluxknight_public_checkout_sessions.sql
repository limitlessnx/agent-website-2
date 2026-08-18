create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  tx_ref text not null unique,
  plan_slug text not null,
  billing_type text not null default 'setup' check (billing_type in ('setup','subscription')),
  billing_region text not null check (billing_region in ('NG','INTERNATIONAL')),
  currency text not null check (currency in ('NGN','USD')),
  amount numeric(14,2) not null check (amount > 0),
  recurring_amount numeric(14,2) null check (recurring_amount is null or recurring_amount >= 0),
  customer_name text not null,
  customer_email text not null,
  customer_phone text null,
  organization_id uuid null references public.organizations(id) on delete set null,
  provider text not null default 'flutterwave',
  provider_transaction_id text null,
  provider_reference text null,
  checkout_url text null,
  status text not null default 'pending' check (status in ('pending','successful','failed','cancelled','expired','verification_failed')),
  provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists checkout_sessions_tx_ref_idx on public.checkout_sessions(tx_ref);
create index if not exists checkout_sessions_status_idx on public.checkout_sessions(status);
create index if not exists checkout_sessions_email_idx on public.checkout_sessions(customer_email);
create index if not exists checkout_sessions_created_at_idx on public.checkout_sessions(created_at desc);

alter table public.checkout_sessions enable row level security;

create or replace function public.touch_checkout_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checkout_sessions_touch_updated_at on public.checkout_sessions;
create trigger checkout_sessions_touch_updated_at
before update on public.checkout_sessions
for each row execute function public.touch_checkout_sessions_updated_at();

insert into public.billing_plans (name, slug, currency, installation_fee, recurring_fee, billing_interval, status, metadata)
values
  ('WhatsApp AI Starter', 'whatsapp-ai-starter', 'NGN', 100000, 50000, 'monthly', 'active', '{"public_catalog":true,"description":"WhatsApp AI lead qualification and follow-up","international":{"currency":"USD","installation_fee":null,"recurring_fee":null}}'::jsonb),
  ('AI Call Receptionist', 'ai-call-receptionist', 'NGN', 200000, 100000, 'monthly', 'active', '{"public_catalog":true,"description":"Inbound AI phone receptionist and qualification","international":{"currency":"USD","installation_fee":null,"recurring_fee":null}}'::jsonb),
  ('AI Front Desk Suite', 'ai-front-desk-suite', 'NGN', 400000, 250000, 'monthly', 'active', '{"public_catalog":true,"description":"WhatsApp, inbound calls and email automation","international":{"currency":"USD","installation_fee":null,"recurring_fee":null}}'::jsonb),
  ('Custom AI Operations', 'custom-ai-operations', 'NGN', 0, 0, 'monthly', 'active', '{"public_catalog":true,"custom":true,"description":"Custom organization-wide AI operations system","international":{"currency":"USD","installation_fee":null,"recurring_fee":null}}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  installation_fee = excluded.installation_fee,
  recurring_fee = excluded.recurring_fee,
  billing_interval = excluded.billing_interval,
  status = excluded.status,
  metadata = public.billing_plans.metadata || excluded.metadata,
  updated_at = now();
